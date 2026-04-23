package mediahandler

import (
	"MediaServer/serverutils"
	"encoding/json"
	"log"

	vips "github.com/cshum/vipsgen/vips816"
)

var rawExtensions = map[string]bool{
	".cr3": true, ".cr2": true, ".arw": true,
	".nef": true, ".raf": true, ".orf": true,
	".rw2": true, ".dng": true,
}

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
			log.Printf("Generating thumbnail")
			msg := d.Body
			var thumbnailRequest msg_type
			json.Unmarshal(msg, &thumbnailRequest)
			err := GenerateThumbnail(thumbnailRequest.SAVEPATH, thumbnailRequest.THUMBNAILSAVEPATH)
			if err != nil {
				log.Printf("Failed to generate thumbnail for %s: %s", thumbnailRequest.SAVEPATH, err)
				d.Acknowledger.Nack(d.DeliveryTag, false, true)
				continue
			}
			err = GeneratePreview(thumbnailRequest.SAVEPATH, thumbnailRequest.PREVIEWPATH)
			if err != nil {
				d.Acknowledger.Nack(d.DeliveryTag, false, true)
				log.Printf("Failed to generate thumbnail or preview for %s", thumbnailRequest.SAVEPATH)

			}

		}
	}()

	log.Printf(" [*] Waiting for messages. To exit press CTRL+C")

	return nil
}

func GenerateThumbnail(imagePath string, thumbnailPath string) error {
	img, err := vips.NewThumbnail(imagePath, 256, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   256,
		Crop:     vips.InterestingAttention,
	})
	if err != nil {
		return err
	}

	return img.Webpsave(thumbnailPath, &vips.WebpsaveOptions{
		Q:        75,
		Lossless: false,
		Effort:   6,
	})
}

func GeneratePreview(imagePath string, previewPath string) error {
	img, err := vips.NewThumbnail(imagePath, 1024, &vips.ThumbnailOptions{
		NoRotate: false,
		Height:   1024,
		Crop:     vips.InterestingNone,
	})
	if err != nil {
		return err
	}

	return img.Webpsave(previewPath, &vips.WebpsaveOptions{
		Lossless: false,
		Effort:   4,
	})
}
