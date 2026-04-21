package collection

import (
	"MediaServer/serverutils"
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type NewCollection struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ThumbnailID uuid.UUID `json:"thumbnail_uuid"`
}

type CollectionUpsertDelFormat struct {
	ImageUUIDs []uuid.UUID `json:"image_uuids"`
}

// Errors reserved for internal server errors only
func CollectionCreation(c *gin.Context, minperm int16) error {
	var newCollectionParam NewCollection
	useruuid, _ := c.Get("userUUID")

	err := c.BindJSON(&newCollectionParam)

	if err != nil {
		c.Status(404)
		return fmt.Errorf("Error in parsing incoming json %s\n", err)
	}

	collection_uuid := uuid.New()
	metadata := map[string]interface{}{}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, pgerr := serverutils.Postgrespool.Exec(ctx, `
	INSERT INTO collections.collection_data
	VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		collection_uuid, useruuid, time.Now(), newCollectionParam.Name, newCollectionParam.Description, newCollectionParam.ThumbnailID, metadata)

	if pgerr != nil {
		c.Status(500)
		return fmt.Errorf("Error on DB insertion: %s", pgerr)
	}

	_, pgerr = serverutils.Postgrespool.Exec(ctx, `
	INSERT INTO collections.collection_userperms
	VALUES ($1, $2, $3)`,
		collection_uuid, useruuid, minperm)

	if pgerr != nil {
		c.Status(500)
		return fmt.Errorf("Error on DB perm insertion: %s", pgerr)
	}

	c.String(201, collection_uuid.String())

	return nil
}

func CollectionEdit(c *gin.Context) error {

	return nil
}

// Errors reserved for internal server errors only
func CollectionDeletion(c *gin.Context, minperm int16) error {
	if v, e := c.Get("collection_perm_level"); e && v.(int16) <= minperm {
		c.Status(403)
		return fmt.Errorf("Permission denied")
	}
	useruuid, _ := c.Get("userUUID")

	collect_uuid := c.Param("collection_id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, pgerr := serverutils.Postgrespool.Exec(ctx, `
	DELETE FROM collections.collection_data
	WHERE uuid = $1 AND owner_uuid = $2`,
		collect_uuid, useruuid)

	if pgerr != nil {
		c.Status(500)
		return fmt.Errorf("Error on DB deletion: %s", pgerr)
	}

	c.String(204, result.String())

	return nil
}

// Errors reserved for internal server errors only
func CollectionContentInsert(c *gin.Context, minperm int16) error {

	ctx := context.Background()
	if v, e := c.Get("collection_perm_level"); e && v.(int16) <= minperm {
		c.Status(403)
		return fmt.Errorf("Permission denied")
	}

	var CollectionInsertParams CollectionUpsertDelFormat
	useruuid, _ := c.Get("userUUID")
	collectionidstring := c.Param("collection_id")
	collection_uuid, err := uuid.Parse(collectionidstring)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("Error in parsing collection UUID%s\n", err)
	}

	err = c.BindJSON(&CollectionInsertParams)

	if err != nil {
		c.Status(400)
		return fmt.Errorf("Error in parsing incoming json %s\n", err)
	}

	rows, pqerr := serverutils.Postgrespool.Query(ctx,
		`	SELECT uuid::text
			FROM galleryindex.images
			WHERE uuid = ANY($1) AND owner_uuid = $2
	`, CollectionInsertParams.ImageUUIDs, useruuid)

	if pqerr != nil {
		c.Status(500)
		return pqerr
	}

	qresult, err := pgx.CollectRows(rows, pgx.RowToMap)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("Error collecting db")
	}

	if len(qresult) != len(CollectionInsertParams.ImageUUIDs) {
		fmt.Println(qresult)
		fmt.Println("----------------")
		fmt.Println(CollectionInsertParams.ImageUUIDs)
		c.Status(400)
		return fmt.Errorf("Bad image ids")
	}

	var collectionentries [][]any
	for _, v := range CollectionInsertParams.ImageUUIDs {
		collectionentries = append(collectionentries, []any{
			collection_uuid,
			v,
		})
	}

	_, pgerr := serverutils.Postgrespool.CopyFrom(
		ctx,
		pgx.Identifier{"collections", "collection_images"},
		[]string{"collection_uuid", "image_uuid"},
		pgx.CopyFromRows(collectionentries))

	if pgerr != nil {
		c.Status(500)
		return fmt.Errorf("Error on DB insertion: %s", pgerr)
	}

	c.Status(201)

	return nil
}
