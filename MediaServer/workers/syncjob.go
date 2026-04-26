package bg_workers

import (
	"MediaServer/mediahandler"
	"MediaServer/serverutils"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	amqp "github.com/rabbitmq/amqp091-go"
)

func DBSyncToStorageJob(ctx context.Context, tcker *time.Ticker, execer serverutils.PostgresExecer, querier serverutils.PostgresQuerier, s3client *s3.Client) {
	for {
		select {
		case <-tcker.C:
			log.Printf("Running storage db sync job")

			//Clears stale upload sessions
			_, err := execer.Exec(ctx, "DELETE FROM s3.uploadstats WHERE created_at < NOW() - INTERVAL '24 hours'")

			if err != nil {
				log.Printf("Failed to clear stale upload sessions: %s", err)
			}

			//Get media entries with status pending upload

			rows, err := querier.Query(ctx, "SELECT uuid, owner_uuid, original_key, thumbnail_key, preview_key FROM galleryindex.images WHERE status = 'pending upload'")
			defer rows.Close()

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

			//Check for pending upload that might've already been uploaded and process them
			//before finalizing the deletion
			for rows.Next() {
				var owneruuid uuid.UUID
				var uuid uuid.UUID
				var originalKeys string
				var thumbnailKey string
				var previewKey string
				rows.Scan(&uuid, &owneruuid, &originalKeys, &thumbnailKey, &previewKey)

				output, err := serverutils.S3client.HeadObject(ctx, &s3.HeadObjectInput{
					Bucket: aws.String(serverutils.S3Bucket),
					Key:    aws.String(originalKeys),
				})

				if err != nil {
					log.Printf("Failed to head object %s: %s", originalKeys, err)
					continue
				}

				if output.ContentLength != nil && *output.ContentLength > 0 {
					_, err := execer.Exec(ctx, "UPDATE galleryindex.images SET status = 'pending processing' WHERE uuid = $1", uuid)
					if err != nil {
						log.Printf("Failed to update media entry status for %s: %s", originalKeys, err)
						continue
					}

					jsonpub, jsonerr := json.Marshal(
						mediahandler.Msg_Type{
							UUID:         uuid.String(),
							OWNERUUID:    owneruuid.String(),
							FILEURLKEY:   originalKeys,
							THUMBNAILKEY: thumbnailKey,
							PREVIEWKEY:   previewKey,
						})

					if jsonerr != nil {
						log.Fatalf("failed to parse json %s", jsonerr)
					}
					//thumbnail generation
					chpuberr := ch.PublishWithContext(ctx,
						"",               // exchange
						q_thumbnail.Name, // routing key
						false,            // mandatory
						false,            // immediate
						amqp.Publishing{
							ContentType: "application/json",
							Body:        jsonpub,
						})

					if chpuberr != nil {
						fmt.Errorf("fail to connect to publish to rabbitmq %s", chpuberr)
					} else {
						log.Printf("[X] Sent %s RBMQ", jsonpub)
					}
					//vector generation
					chpuberr_vec := ch.PublishWithContext(ctx,
						"",            // exchange
						q_vector.Name, // routing key
						false,         // mandatory
						false,         // immediate
						amqp.Publishing{
							ContentType: "application/json",
							Body:        jsonpub,
						})

					if chpuberr_vec != nil {
						fmt.Errorf("fail to connect to publish to rabbitmq vector %s", chpuberr_vec)
					} else {
						log.Printf("[X] Sent (to Vector) %s RBMQ ", jsonpub)
					}

					//metadata generation
					chpuberr_meta := ch.PublishWithContext(ctx,
						"",              // exchange
						q_metadata.Name, // routing key
						false,           // mandatory
						false,           // immediate
						amqp.Publishing{
							ContentType: "application/json",
							Body:        jsonpub,
						})

					if chpuberr_meta != nil {
						fmt.Errorf("fail to connect to publish to rabbitmq metadata %s", chpuberr_vec)
					} else {
						log.Printf("[X] Sent (to Metadata) %s RBMQ ", jsonpub)
					}
				} else {
					log.Printf("Object %s has zero content length, skipping", originalKeys)
				}
			}

			if err != nil {
				log.Printf("Failed to get images for processing entries: %s", err)
			}

			//Delete stale media entries incompleted after 24 hours
			_, err = execer.Exec(ctx, "DELETE FROM galleryindex.images WHERE created_at < NOW() - INTERVAL '24 hours' AND status = 'pending upload'")

			if err != nil {
				log.Printf("Failed to clear stale media entries: %s", err)
			}

			log.Printf("Storage db sync job completed")

		case <-ctx.Done():
			log.Printf("Storage db sync job stopped")
			return
		}
	}

}

func VectorSyncToDBJob(ctx context.Context, tcker *time.Ticker, querier serverutils.PostgresQuerier) {
	log.Printf("Vector sync job started")
	for {
		select {
		case <-ctx.Done():
			log.Printf("Vector sync job stopped")
			return
		case <-tcker.C:
			sql := ("SELECT uuid, original_key, thumbnail_key, preview_key from galleryindex.images WHERE NOT embedder_id = $1")
			rows, err := querier.Query(ctx, sql, os.Getenv("MODEL_ID"))

			if err != nil {
				log.Fatalf("query fails %s", err)
			}

			qresult, err := pgx.CollectRows(rows, pgx.RowToMap)

			if err != nil {
				log.Fatalf("query parse fails %s", err)
			}

			if len(qresult) == 0 {
				continue
			}

			log.Println("Out of date vector embedding found")

			ch := serverutils.FailOnError(func() (*amqp.Channel, error) {
				return serverutils.Rabbitmqconnection.Channel()
			}, "", "failed to open rabbitmq channel", context.Background())
			defer ch.Close()

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

			for _, v := range qresult {
				body, _ := json.Marshal(mediahandler.Msg_Type{
					UUID:         v["uuid"].(string),
					FILEURLKEY:   v["original_key"].(string),
					THUMBNAILKEY: v["thumbnail_key"].(string),
					PREVIEWKEY:   v["preview_key"].(string),
				})
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
					log.Printf("failed to publish vectormessage: %s", err)
					continue
				}
			}
		}

	}

}
