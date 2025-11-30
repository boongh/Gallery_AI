package collection

import (
	"MediaServer/serverutils"
	"context"
	"log"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NewCollection struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Errors reserved for internal server errors only
func NewCollectionHandler(c *gin.Context) error {
	var newcolparam NewCollection
	err := c.BindJSON(&newcolparam)

	form, formerr := c.MultipartForm()
	if formerr != nil {
		c.Status(400)
		return nil
	}

	files := form.File["thumbnail_file"]

	if len(files) > 1 {
		c.Status(400)
		return nil
	}

	if err != nil {
		log.Printf("error in parsing incoming json %s\n", err)

		//Bad requests are handled inside
		c.Status(404)

		//No server errors
		return nil
	}

	collect_uuid := uuid.New()
	metadata := map[string]interface{}{}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, pgerr := serverutils.Postgrespool.Exec(ctx, `
	INSERT INTO collections.collection_data
	VALUES ($1, $2, $3, $4, $5)`,
		collect_uuid, time.Now(), newcolparam.Name, newcolparam.Description, metadata)

	if pgerr != nil {
		return pgerr
	}

	c.String(200, result.String())

	return nil
}
