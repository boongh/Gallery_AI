package collection

import (
	"MediaServer/serverutils"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CollectionQueryBind struct {
	Want   string `form:"want"`
	Offset int    `form:"offset"`
	Limit  int    `form:"limit"`
}

var ValidCollectionAttributes = []string{"uuid", "created_at", "name", "description", "metadata"}

func CollectionQuery(c *gin.Context) error {
	var query CollectionQueryBind
	binderr := c.BindQuery(&query)

	fmt.Println(query)

	if binderr != nil {
		return binderr
	}

	var wantattributes []string = strings.Split(query.Want, "-")
	selectstatement := serverutils.BuildSQL(ValidCollectionAttributes, wantattributes)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pq, pqerr := serverutils.Postgrespool.Query(ctx, fmt.Sprintf(
		`	SELECT %s FROM collections.collection_data
			OFFSET $1
			LIMIT $2
	`, selectstatement), query.Offset, query.Limit)

	if pqerr != nil {
		return pqerr
	}

	var result []map[string]interface{}

	for pq.Next() {
		newval, _ := pq.Values()
		//Json construction
		rowmap := make(map[string]interface{}, 1)

		for i, v := range newval {
			if wantattributes[i] == "uuid" {
				a, ok := v.([16]byte)
				if !ok {
					panic(fmt.Sprintf("Type assersion failed. Expected uint8 but got %T", v))
				}

				b := a[:]
				idstr, _ := uuid.FromBytes(b)
				rowmap[wantattributes[i]] = idstr.String()
			} else {
				rowmap[wantattributes[i]] = v
			}
		}

		result = append(result, rowmap)
	}
	fmt.Println(result)
	c.JSON(200, result)

	return nil
}
