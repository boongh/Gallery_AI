package mediahandler

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"mime/multipart"
	"os"
	"path"
	"strings"
	"time"

	"MediaServer/serverutils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
)

type msg_type struct {
	UUID              string `json:"uuid"`
	FILEURLPATH       string `json:"fileurlpath"`
	SAVEPATH          string `json:"savepath"`
	THUMBNAILSAVEPATH string `json:"thumbnailsavepath"`
	THUMBNAILURLPATH  string `json:"thumbnailurlpath"`
	COLLECTIONID      string `json:"collection_id"`
}

type Server struct {
	Pool *pgxpool.Pool
}

func MediaUploadHandler(c *gin.Context, querier PostgresQuerier, inserter ImagePostgresInserter) error {

	userUUID, exist := c.Get("userUUID")
	collectionID := c.Param("collection_id")

	if !exist {
		c.Status(401)
		return fmt.Errorf("Unauthorized: User not authenticated")
	}

	query := `SELECT uuid FROM collections.collection_data
				WHERE uuid = $1 AND owner_uuid = $2`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := querier.Query(ctx, query, collectionID, userUUID)

	if err != nil {
		log.Fatalf("query fails %s", err)
	}

	defer rows.Close()

	if !rows.Next() {
		c.Status(404)
		return fmt.Errorf("No collection found for user %s", userUUID)
	}

	q_thumbnail := serverutils.FailOnError(func() (amqp.Queue, error) {
		return serverutils.Rabbitmqchannel.QueueDeclare(
			"thumbnail_generation_queue", // name
			true,                         // durable
			false,                        // delete when unused
			false,                        // exclusive
			false,                        // no-wait
			nil,                          // arguments
		)
	}, "", "failed to initialize thumbnail queue", context.Background())

	q_vector := serverutils.FailOnError(func() (amqp.Queue, error) {
		return serverutils.Rabbitmqchannel.QueueDeclare(
			"vector_generation_queue", // name
			true,                      // durable
			false,                     // delete when unused
			false,                     // exclusive
			false,                     // no-wait
			nil,                       // arguments
		)
	}, "", "failed to initialize vector queue", context.Background())

	form := serverutils.FailOnError(func() (*multipart.Form, error) {
		return c.MultipartForm()
	}, "successfully parsed form", "fail to parse form", context.Background())

	ctx, cancel = context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	files := form.File["files"]

	//{uuid}, {format}, {filepath}, {thumbnail path}, {status}, {created at}, {uploaded at}, {metadata}
	entries := [][]any{}

	collectionentries := [][]any{}

	message := []msg_type{}

	for _, file := range files {

		image_uuid := uuid.New().String()
		extension := strings.Split(file.Header.Get("Content-Type"), "/")
		fmt.Println(extension)

		saveurl := "gms/media/originals/" + image_uuid
		thumbnailsaveurl := "gms/media/thumbnails/" + image_uuid

		savefilepath := path.Join(os.Getenv("APP_DATA"), "media", "originals", image_uuid)
		thumbnailsavepath := path.Join(os.Getenv("APP_DATA"), "media", "thumbnails", image_uuid)

		fmt.Println("Saving file to:", savefilepath)

		err := c.SaveUploadedFile(file, savefilepath, fs.FileMode.Perm(0o755))

		if err != nil {
			return fmt.Errorf("failed to save uploaded file: %s", err)
		}

		metadata := []byte(`{}`)

		entries = append(entries, []any{
			image_uuid,
			userUUID.(string),
			file.Header.Get("Content-Type"),
			saveurl,
			"",
			"pending indexing",
			time.Now(),
			time.Now(),
			metadata,
		})

		collectionentries = append(collectionentries, []any{
			userUUID.(string),
			image_uuid,
			time.Now(),
		})

		var p msg_type = msg_type{
			UUID:              image_uuid,
			FILEURLPATH:       saveurl,
			SAVEPATH:          savefilepath,
			THUMBNAILSAVEPATH: thumbnailsavepath,
			THUMBNAILURLPATH:  thumbnailsaveurl,
			COLLECTIONID:      userUUID.(string),

			// STATUS: "pending thumbnail",
			// CREATEDAT: time.Now(),
			// UPLOADEDAT: time.Now(),
			// METADATA: metadata,
		}

		message = append(message, p)

	}

	_, err = serverutils.Postgrespool.CopyFrom(
		context.Background(),
		pgx.Identifier{"galleryindex", "images"},
		[]string{"uuid",
			"owner_uuid",
			"format",
			"filepath",
			"thumbnail_filepath",
			"status",
			"created_at",
			"uploaded_at",
			"metadata"},
		pgx.CopyFromRows(entries))

	if err != nil {
		return fmt.Errorf("Fail to insert images indices into database %s", err)
	}

	_, err = serverutils.Postgrespool.CopyFrom(
		context.Background(),
		pgx.Identifier{"collections", "collection_images"},
		[]string{"collection_uuid", "image_uuid", "added_at"},
		pgx.CopyFromRows(collectionentries))

	if err != nil {
		return fmt.Errorf("Fail to insert user collection database %s", err)
	}

	for _, m := range message {

		jsonpub, jsonerr := json.Marshal(m)

		if jsonerr != nil {
			log.Fatalf("failed to parse json %s", jsonerr)
		}

		fmt.Printf("parsed %v", jsonpub)

		//thumbnail generation
		chpuberr := serverutils.Rabbitmqchannel.PublishWithContext(ctx,
			"",               // exchange
			q_thumbnail.Name, // routing key
			false,            // mandatory
			false,            // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        jsonpub,
			})

		if chpuberr != nil {
			return fmt.Errorf("fail to connect to publish to rabbitmq %s", chpuberr)
		} else {
			log.Printf("[X] Sent %s RBMQ", jsonpub)
		}

		//vector generation
		chpuberr_vec := serverutils.Rabbitmqchannel.PublishWithContext(ctx,
			"",            // exchange
			q_vector.Name, // routing key
			false,         // mandatory
			false,         // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        jsonpub,
			})

		if chpuberr_vec != nil {
			return fmt.Errorf("fail to connect to publish to rabbitmq vector %s", chpuberr_vec)
		} else {
			log.Printf("[X] Sent (to Vector) %s RBMQ ", jsonpub)
		}
	}

	c.Status(201)

	return nil
}
