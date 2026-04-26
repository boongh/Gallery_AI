package mediahandler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"MediaServer/serverutils"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/transport/http"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	amqp "github.com/rabbitmq/amqp091-go"
)

type Msg_Type struct {
	UUID           string `json:"uuid"`
	OWNERUUID      string `json:"owner_uuid"`
	COLLECTIONUUID string `json:"collection_uuid"`
	FILEURLKEY     string `json:"original_url"`
	THUMBNAILKEY   string `json:"thumbnail_url"`
	PREVIEWKEY     string `json:"preview_url"`
}

func MediaUploadInit(c *gin.Context, s3Client *s3.Client, postgresPool *pgxpool.Pool) error {
	count, err := strconv.Atoi(c.Query("count"))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	userUUID, _ := c.Get("userUUID")
	if err != nil {
		count = 1
	}

	presigner := s3.NewPresignClient(s3Client)

	buckOut, err := s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
		Bucket: aws.String(serverutils.S3Bucket),
	})
	if err != nil {
		// Check if it's a 404 (bucket doesn't exist)
		var httpErr *http.ResponseError
		if errors.As(err, &httpErr) && httpErr.HTTPStatusCode() == 404 {
			fmt.Printf("Bucket %s does not exist yet, creating...\n", serverutils.S3Bucket)
			_, errBuck := s3Client.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(serverutils.S3Bucket),
			})
			if errBuck != nil {
				return fmt.Errorf("failed to create S3 bucket: %s", errBuck)
			}
		} else {
			// Some other error (auth, network, wrong endpoint, etc.)
			return fmt.Errorf("failed to access S3 bucket: %s", err)
		}
	} else {
		_ = buckOut // bucket exists, all good
	}

	resList := []string{}
	uuids := []uuid.UUID{}
	uploadid := uuid.New()
	entries := [][]any{}

	for i := 0; i < count && i < 1000; i++ {

		bucketName := serverutils.S3Bucket
		itemUUID := uuid.New()
		uuids = append(uuids, itemUUID)

		itemSharedSuffix := uploadid.String() + userUUID.(string) + "/" + itemUUID.String()
		og_key := "/originals/" + itemSharedSuffix
		t_key := "/thumbnails/" + itemSharedSuffix
		p_key := "/previews/" + itemSharedSuffix

		input := &s3.PutObjectInput{
			Bucket: &bucketName,
			Key:    &og_key,
			// You can also add metadata, content-type constraints, etc.
		}

		res, err := presigner.PresignPutObject(context.Background(), input, func(opts *s3.PresignOptions) {
			opts.Expires = 15 * time.Minute
			opts.ClientOptions = append(opts.ClientOptions, func(o *s3.Options) {
				o.BaseEndpoint = aws.String(serverutils.S3PublicEndpoint)
			})
		})

		if err != nil {
			return fmt.Errorf("failed to generate presigned URL: %s", err)
		}

		resList = append(resList, res.URL)

		entries = append(entries, []any{
			itemUUID,
			userUUID,
			nil,
			og_key,
			t_key,
			p_key,
			"pending upload",
			time.Now(),
			time.Now(),
			nil,
		})
	}

	_, err = postgresPool.Exec(context.Background(),
		"INSERT INTO s3.uploadstats (uuid, user_uuid, upload_uuids, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)",
		uploadid, userUUID, uuids, time.Now().Add(time.Minute*15), time.Now())
	if err != nil {
		return fmt.Errorf("failed to insert upload session: %s", err)
	}

	_, err = postgresPool.CopyFrom(ctx, pgx.Identifier{"galleryindex", "images"},
		[]string{"uuid", "owner_uuid", "format", "original_key", "thumbnail_key", "preview_key", "status", "created_at", "uploaded_at", "metadata"},
		pgx.CopyFromRows(entries))
	if err != nil {
		return fmt.Errorf("failed to pre-populate image entries: %s", err)
	}

	c.JSON(200, map[string]any{
		"upload_id":      uploadid,
		"presigned_urls": resList,
		"expiration":     15 * time.Minute,
	})

	return nil
}

func MediaUploadVerify(c *gin.Context, postgresPool *pgxpool.Pool) error {

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	uploadID := c.Param("upload_id")
	userUUID, _ := c.Get("userUUID")

	var exists bool
	err := postgresPool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM s3.uploadstats WHERE uuid = $1 AND user_uuid = $2 AND expires_at > NOW() - INTERVAL '24 hour')`,
		uuid.MustParse(uploadID), userUUID,
	).Scan(&exists)

	if !exists {
		c.Status(404)
		return fmt.Errorf("upload session not found or expired")
	}

	//uploadID valid -->

	output, err := serverutils.S3client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(serverutils.S3Bucket),
		Prefix: aws.String("/originals/" + uploadID),
	})

	var existids []uuid.UUID
	for _, v := range output.Contents {
		token := strings.Split(*v.Key, "/")
		id := token[len(token)-1]
		parsed, _ := uuid.Parse(id)
		existids = append(existids, parsed)
	}

	sql := `UPDATE galleryindex.images
			SET status = 'pending processing'
			WHERE uuid = ANY($1) AND status = 'pending upload'
			RETURNING uuid::text, original_key, thumbnail_key, preview_key`

	rows, err := postgresPool.Query(context.Background(), sql, existids)
	var ToWorkerList []Msg_Type

	defer rows.Close()
	for rows.Next() {
		var message Msg_Type
		err = rows.Scan(&message.UUID, &message.FILEURLKEY, &message.THUMBNAILKEY, &message.PREVIEWKEY)

		if err != nil {
			c.Status(400)
			return fmt.Errorf("failed to query upload stats: %s", err)
		}

		ToWorkerList = append(ToWorkerList, message)
	}

	ch := serverutils.FailOnError(func() (*amqp.Channel, error) {
		return serverutils.Rabbitmqconnection.Channel()
	}, "", "failed to open rabbitmq channel", context.Background())
	defer ch.Close()

	q_thumbnail := serverutils.FailOnError(func() (amqp.Queue, error) {
		return ch.QueueDeclare(
			"thumbnail_preview_generation_queue", // name
			true,                                 // durable
			false,                                // delete when unused
			false,                                // exclusive
			false,                                // no-wait
			nil,                                  // arguments
		)
	}, "", "failed to initialize thumbnail queue", context.Background())

	q_vector := serverutils.FailOnError(func() (amqp.Queue, error) {
		return ch.QueueDeclare(
			"vector_generation_queue", // name
			true,                      // durable
			false,                     // delete when unused
			false,                     // exclusive
			false,                     // no-wait
			nil,                       // arguments
		)
	}, "", "failed to initialize vector queue", context.Background())

	q_metadata := serverutils.FailOnError(func() (amqp.Queue, error) {
		return ch.QueueDeclare(
			"metadata_generation_queue", // name
			true,                        // durable
			false,                       // delete when unused
			false,                       // exclusive
			false,                       // no-wait
			nil,                         // arguments
		)
	}, "", "failed to initialize metadata queue", context.Background())

	for _, msg := range ToWorkerList {
		body, _ := json.Marshal(msg)

		err := serverutils.Rabbitmqchannel.PublishWithContext(ctx,
			"",               // exchange
			q_thumbnail.Name, // routing key
			false,            // mandatory
			false,            // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
			},
		)

		if err != nil {
			return fmt.Errorf("failed to publish message gen thumbnail: %s", err)
		}

		err = serverutils.Rabbitmqchannel.PublishWithContext(ctx,
			"",              // exchange
			q_metadata.Name, // routing key
			false,           // mandatory
			false,           // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
			},
		)

		if err != nil {
			return fmt.Errorf("failed to publish message gen metadata: %s", err)
		}

		err = serverutils.Rabbitmqchannel.PublishWithContext(ctx,
			"",            // exchange
			q_vector.Name, // routing key
			false,         // mandatory
			false,         // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        body,
			},
		)

		if err != nil {
			return fmt.Errorf("failed to publish vectormessage: %s", err)
		}
	}

	c.Status(200)
	return nil
}
