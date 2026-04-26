package bg_workers

import (
	"MediaServer/mediahandler"
	"MediaServer/serverutils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	vips "github.com/cshum/vipsgen/vips"
)

func StartThumbnailWorker(queue string) error {
	conn, channel, q := serverutils.RabbitMQConnect(queue)

	msgs, err := channel.Consume(
		q.Name, // queue
		"",     // consumer
		false,  // auto-ack
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)

	if err != nil {
		log.Fatalf("Failed to register a consumer: %s", err)
		return err
	}
	go func() {
		defer conn.Close()
		defer channel.Close()
		for d := range msgs {
			func() {
				var req mediahandler.Msg_Type
				defer d.Acknowledger.Ack(d.DeliveryTag, false)
				if err := json.Unmarshal(d.Body, &req); err != nil {
					log.Printf("Failed to parse message: %s", err)
					return
				}
				log.Printf("Generating thumbnail for:\n%s\n%s\n%s\n",
					req.FILEURLKEY, req.THUMBNAILKEY, req.PREVIEWKEY)

				ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
				defer cancel()

				// Download original from S3
				getOut, err := serverutils.S3client.GetObject(ctx, &s3.GetObjectInput{
					Bucket: aws.String(serverutils.S3Bucket),
					Key:    aws.String(req.FILEURLKEY),
				})
				if err != nil {
					fmt.Printf("Failed to read original %s: %s", req.FILEURLKEY, err)

					return
				}

				originalData, err := io.ReadAll(getOut.Body)
				getOut.Body.Close()
				if err != nil {
					log.Printf("Failed to read original %s: %s", req.FILEURLKEY, err)

					return
				}

				tempData, err := os.CreateTemp("", "temp-tpgen-*")
				if err != nil {
					log.Printf("Failed to create temp file for %s: %s", req.FILEURLKEY, err)

					return
				}
				defer os.Remove(tempData.Name())

				if _, err := tempData.Write(originalData); err != nil {
					log.Printf("Failed to write to create temp file for %s: %s", req.FILEURLKEY, err)

					return
				}
				defer tempData.Close()

				img, errimg := vips.NewImageFromBuffer(originalData, vips.DefaultLoadOptions())
				if errimg != nil {
					log.Printf("Loading RAW %s", errimg)
					img, errimg = vips.NewDcrawloadBuffer(originalData, vips.DefaultDcrawloadBufferOptions())
					if errimg != nil {
						log.Printf("Could not load image at all %s", errimg)

						return
					}
				}
				_ = img.Autorot(&vips.AutorotOptions{Flip: false})

				defer img.Close()

				copy, _ := img.Copy(vips.DefaultCopyOptions())
				defer copy.Close()

				if err != nil {
					log.Printf("Could not read to memory %s", err)
				}
				{

					buff, err := GenerateThumbnailImage(img)

					if err != nil {
						log.Printf("Failed to generate thumbnail for %s: %s", req.FILEURLKEY, err)
						return
					}

					_, err = serverutils.S3client.PutObject(ctx, &s3.PutObjectInput{
						Bucket:      aws.String(serverutils.S3Bucket),
						Key:         aws.String(req.THUMBNAILKEY),
						Body:        bytes.NewReader(buff),
						ContentType: aws.String("image/webp"),
					})

					if err != nil {
						log.Printf("Failed to upload thumbnail for %s: %s", req.FILEURLKEY, err)
						return
					}
				}
				{

					buff, err := GeneratePreviewImage(copy)
					if err != nil {
						log.Printf("Failed to generate thumbnail for %s: %s", req.FILEURLKEY, err)
						return
					}
					_, err = serverutils.S3client.PutObject(ctx, &s3.PutObjectInput{
						Bucket:      aws.String(serverutils.S3Bucket),
						Key:         aws.String(req.PREVIEWKEY),
						Body:        bytes.NewReader(buff),
						ContentType: aws.String("image/webp"),
					})

					if err != nil {
						log.Printf("Failed to upload thumbnail for %s: %s", req.FILEURLKEY, err)
						return
					}
				}

				// Mark active
				_, err = serverutils.Postgrespool.Exec(ctx,
					`UPDATE galleryindex.images SET status = 'active' WHERE uuid = $1 AND status = 'pending processing'`,
					req.UUID)

				if err != nil {
					log.Printf("Failed to update status for %s: %s", req.UUID, err)

					return
				}
				log.Printf(" [*] Waiting for messages. To exit press CTRL+C")

			}()

		}
	}()

	log.Printf(" [*] Waiting for messages. To exit press CTRL+C")

	return nil
}

func GenerateThumbnailBuffer(imageSource []byte) ([]byte, error) {
	img, err := vips.NewThumbnailBuffer(imageSource, 256, &vips.ThumbnailBufferOptions{
		NoRotate: false,
		Height:   256,
		Crop:     vips.InterestingAttention,
	})
	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GeneratePreviewBuffer(imageSource []byte) ([]byte, error) {
	img, err := vips.NewThumbnailBuffer(imageSource, 1024, &vips.ThumbnailBufferOptions{
		NoRotate: false,
		Height:   1024,
		Crop:     vips.InterestingNone,
	})

	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GenerateThumbnailFile(filename string) ([]byte, error) {
	img, err := vips.NewThumbnail(filename, 256, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   256,
		Crop:     vips.InterestingAttention,
	})
	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GeneratePreviewFile(filename string) ([]byte, error) {
	img, err := vips.NewThumbnail(filename, 1024, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   1024,
		Crop:     vips.InterestingNone,
	})

	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GenerateThumbnailSource(filename string) ([]byte, error) {
	img, err := vips.NewThumbnail(filename, 256, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   256,
		Crop:     vips.InterestingAttention,
	})
	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GeneratePreviewSource(filename string) ([]byte, error) {
	img, err := vips.NewThumbnail(filename, 1024, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   1024,
		Crop:     vips.InterestingNone,
	})

	defer img.Close()
	if err != nil {
		return nil, err
	}

	return img.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GenerateThumbnailImage(image *vips.Image) ([]byte, error) {
	err := image.ThumbnailImage(256, &vips.ThumbnailImageOptions{
		NoRotate: false,
		Height:   256,
		Crop:     vips.InterestingAttention,
	})

	if err != nil {
		return nil, err
	}

	return image.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GeneratePreviewImage(image *vips.Image) ([]byte, error) {
	err := image.ThumbnailImage(1024, &vips.ThumbnailImageOptions{
		NoRotate: false,
		Height:   1024,
		Crop:     vips.InterestingNone,
	})

	if err != nil {
		return nil, err
	}

	return image.WebpsaveBuffer(&vips.WebpsaveBufferOptions{
		Q:        85,
		Lossless: false,
		Effort:   6,
	})
}
