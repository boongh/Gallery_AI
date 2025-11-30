package mediahandler

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

	"MediaServer/serverutils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
)

type msg_type struct {
	UUID        string `json:"uuid"`
	FILEURLPATH string `json:"fileurlpath"`
	SAVEPATH    string `json:"savepath"`
}

type Server struct {
	Pool *pgxpool.Pool
}

func MediaUploadHandler(c *gin.Context) error {

	q := serverutils.FailOnError(func() (amqp.Queue, error) {
		return serverutils.Rabbitmqchannel.QueueDeclare(
			"image_processing_queue", // name
			true,                     // durable
			false,                    // delete when unused
			false,                    // exclusive
			false,                    // no-wait
			nil,                      // arguments
		)
	}, "", "failed to initialize queue", context.Background())

	form := serverutils.FailOnError(func() (*multipart.Form, error) {
		return c.MultipartForm()
	}, "successfully parsed form", "fail to parse form", context.Background())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	files := form.File["files"]

	//{uuid}, {format}, {filepath}, {thumbnail path}, {status}, {created at}, {uploaded at}, {metadata}
	entries := [][]any{}

	for _, file := range files {

		image_uuid := uuid.New().String()
		extension := strings.Split(file.Header.Get("Content-Type"), "/")
		fmt.Println(extension)
		savefilename := image_uuid + "." + extension[len(extension)-1]
		saveurl := "/media/originals/" + savefilename

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
		chpuberr := serverutils.Rabbitmqchannel.PublishWithContext(ctx,
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

	_, err := serverutils.Postgrespool.CopyFrom(context.Background(), pgx.Identifier{"galleryindex", "images"}, []string{"uuid", "format", "filepath", "thumbnail_filepath", "status", "created_at", "uploaded_at", "metadata"}, pgx.CopyFromRows(entries))

	if err != nil {
		return fmt.Errorf("fail to insert into database %s", err)
	}

	return nil
}
