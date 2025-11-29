package upload

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	amqp "github.com/rabbitmq/amqp091-go"
)

func ImageUploadHandler(c *gin.Context) error {

	pgcon := failOnError(func() (*pgx.Conn, error) {
		return pgx.Connect(context.Background(),
			fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
				os.Getenv("PGUSER"),
				os.Getenv("PGPASSWORD"),
				os.Getenv("PGHOST"),
				os.Getenv("PGPORT"),
				os.Getenv("PGDATABASE")))
	}, "successfully connected to postgres", "postgress connection error", context.Background())

	rbmqconn := failOnError(func() (*amqp.Connection, error) {
		return amqp.Dial(fmt.Sprintf("amqp://%s:%s@%s:%s/",
			os.Getenv("RABBITUSER"),
			os.Getenv("RABBITPASSWORD"),
			os.Getenv("RABBITHOST"),
			os.Getenv("RABBITPORT"),
		))
	}, "successfully connected to rbmq", "failed to connect to rbmq", context.Background())

	form := failOnError(func() (*multipart.Form, error) {
		return c.MultipartForm()
	}, "successfully parsed form", "fail to parse form", context.Background())

	defer rbmqconn.Close()
	defer pgcon.Close(context.Background())

	ch := failOnError(func() (*amqp.Channel, error) {
		return rbmqconn.Channel()
	}, "", "failed to connecto to channel", context.Background())

	defer ch.Close()

	q := failOnError(func() (amqp.Queue, error) {
		return ch.QueueDeclare(
			"image_processing_queue", // name
			true,                     // durable
			false,                    // delete when unused
			false,                    // exclusive
			false,                    // no-wait
			nil,                      // arguments
		)
	}, "", "failed to initialize queue", context.Background())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	files := form.File["files"]

	//{uuid}, {format}, {filepath}, {thumbnail path}, {status}, {created at}, {uploaded at}, {metadata}
	entries := [][]any{}

	for _, file := range files {
		type msg_type struct {
			UUID        string `json:"uuid"`
			FILEURLPATH string `json:"fileurlpath"`
			SAVEPATH    string `json:"savepath"`
		}

		image_uuid := uuid.New().String()
		extension := strings.Split(file.Header.Get("Content-Type"), "/")
		fmt.Println(extension)
		savefilename := image_uuid + "." + extension[len(extension)-1]
		saveurl := "/images/originals/" + savefilename

		savefilepath, fperr := filepath.Abs(os.Getenv("APP_DATA") + "/" + saveurl)
		_ = fperr
		saverr := c.SaveUploadedFile(file, savefilepath)

		if saverr != nil {
			return errors.New("image saving fail")
		}

		metadata := []byte(`{}`)

		entries = append(entries, []any{
			image_uuid,
			file.Header.Get("Content-Type"),
			saveurl,
			"",
			"pending indexing",
			time.Now(),
			time.Now(),
			metadata,
		})

		var p msg_type = msg_type{
			UUID:        image_uuid,
			FILEURLPATH: saveurl,
			SAVEPATH:    savefilepath,
		}

		jsonpub, jsonerr := json.Marshal(p)
		if jsonerr != nil {
			log.Fatalf("failed to parse json %s", jsonerr)
		}

		fmt.Printf("parsed %v", jsonpub)
		chpuberr := ch.PublishWithContext(ctx,
			"",     // exchange
			q.Name, // routing key
			false,  // mandatory
			false,  // immediate
			amqp.Publishing{
				ContentType: "application/json",
				Body:        jsonpub,
			})

		if chpuberr != nil {
			return fmt.Errorf("fail to connect to publish to rabbitmq %s", chpuberr)
		} else {
			log.Printf("[X] Sent %s RBMQ", jsonpub)
		}
	}

	_, err := pgcon.CopyFrom(context.Background(), pgx.Identifier{"galleryindex", "images"}, []string{"uuid", "format", "filepath", "thumbnail_filepath", "status", "created_at", "uploaded_at", "metadata"}, pgx.CopyFromRows(entries))

	if err != nil {
		return fmt.Errorf("fail to insert into database %s", err)
	}

	return nil
}
