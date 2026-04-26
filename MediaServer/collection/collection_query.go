package collection

import (
	"MediaServer/serverutils"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
)

type CollectionContentQueryBind struct {
	Want   string `form:"want"`
	Offset int    `form:"offset"`
	Limit  int    `form:"limit"`
}

type CollectionListQueryBind struct {
	Offset int `form:"offset"`
	Limit  int `form:"limit"`
}

func CollectionInfo(c *gin.Context, minperm int16) error {

	if v, e := c.Get("collection_perm_level"); e && v.(int16) <= minperm {
		c.Status(403)
		return fmt.Errorf("Permission denied")
	}

	useruuid, _ := c.Get("userUUID")
	collectionID := c.Param("collection_id")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rows, pqerr := serverutils.Postgrespool.Query(ctx,
		`	SELECT * 
			FROM collections.collection_data
			WHERE owner_uuid = $1 AND uuid = $2
			LIMIT 1
	`, useruuid, collectionID)

	if pqerr != nil {
		return pqerr
	}

	qresult, err := pgx.CollectRows(rows, pgx.RowToMap)
	if err != nil {
		c.Status(500)
		return fmt.Errorf("query parsing fails %s", err)
	}

	c.JSON(200, qresult)

	return nil
}

func CollectionContentQuery(c *gin.Context, permissionlevelreq int16, urlpathroot string) error {

	if v, e := c.Get("collection_perm_level"); e && v.(int16) <= permissionlevelreq {
		c.Status(403)
		return fmt.Errorf("Permission denied")
	}
	var queryParam CollectionContentQueryBind
	binderr := c.BindQuery(&queryParam)
	//useruuid, _ := c.Get("userUUID")

	collectionID := c.Param("collection_id")

	if binderr != nil {
		return binderr
	}

	//Special mapping for uuid to return as text instead
	wantattributes := serverutils.Map(strings.Split(queryParam.Want, "-"), func(attr string) string {
		attrnamemap := map[string]string{
			"uuid": "uuid::text",
		}
		if val, ok := attrnamemap[attr]; ok {
			return val
		}
		return attr
	})

	selectstatement := serverutils.BuildSQL(
		append(serverutils.ValidCollectionAttributes, serverutils.ValidMediaAttributes...), wantattributes)

	fmt.Println(selectstatement)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	rows, pqerr := serverutils.Postgrespool.Query(ctx, fmt.Sprintf(
		`	SELECT %s 
			FROM galleryindex.images
			INNER JOIN collections.collection_images
			ON collections.collection_images.image_uuid = galleryindex.images.uuid
			WHERE collections.collection_images.collection_uuid = $1
			ORDER BY added_at ASC
			OFFSET $2
			LIMIT $3
	`, selectstatement), collectionID, queryParam.Offset, queryParam.Limit)

	if pqerr != nil {
		return pqerr
	}
	defer rows.Close()

	qresult, err := pgx.CollectRows(rows, pgx.RowToMap)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("query parsing fails %s", err)
	}

	var nexturl string
	if len(qresult) == queryParam.Limit {
		nexturl = fmt.Sprintf(urlpathroot+"/%s/contents?offset=%d&limit=%d&want=%s", collectionID, queryParam.Offset+queryParam.Limit, queryParam.Limit, queryParam.Want)
	}

	c.JSON(200, serverutils.PaginatedResponse{
		Content: qresult,
		Next:    nexturl,
	})

	return nil
}

func GetAvailCollections(c *gin.Context, urlpathroot string) error {
	var queryParam CollectionListQueryBind
	useruuid, _ := c.Get("userUUID")

	binderr := c.BindQuery(&queryParam)

	if binderr != nil {
		c.Status(400)
		return fmt.Errorf("Error binding query param: %s", binderr)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	queryStatement := `
		SELECT collections.collection_data.uuid::text, collections.collection_data.created_at, name, description, galleryindex.images.uuid::text AS thumbnail_uuid
		FROM collections.collection_userperms
		JOIN collections.collection_data
		ON collections.collection_data.uuid = collections.collection_userperms.collection_uuid
		LEFT JOIN galleryindex.images
		ON galleryindex.images.uuid = collections.collection_data.thumbnail_image_uuid
		WHERE collections.collection_userperms.user_uuid = $1 AND permission > 0
		ORDER BY created_at DESC
		LIMIT $2
		OFFSET $3
	`

	// fmt.Print(query)
	rows, err := serverutils.Postgrespool.Query(
		ctx, queryStatement, useruuid, queryParam.Limit, queryParam.Offset)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("query fails %s", err)
	}
	defer rows.Close()

	qresult, err := pgx.CollectRows(rows, pgx.RowToMap)

	var nexturl string
	if len(qresult) == queryParam.Limit {
		nexturl = fmt.Sprintf(urlpathroot+"?offset=%d&limit=%d", queryParam.Offset+queryParam.Limit, queryParam.Limit)
	}

	if err != nil {
		c.Status(500)
		return fmt.Errorf("query parsing fails %s", err)
	}

	c.JSON(200, serverutils.PaginatedResponse{
		Content: qresult,
		Next:    nexturl,
	})
	return nil
}
