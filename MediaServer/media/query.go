package mediahandler

import (
	"MediaServer/serverutils"
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/qdrant/go-client/qdrant"
)

var ValidMediaAttributes = []string{"uuid", "format", "filepath", "thumbnail_filepath", "status", "created_at", "uploaded_at", "metadata"}

type MediaQueryParam struct {
	Offset int    `form:"offset"`
	Limit  int    `form:"limit"`
	Want   string `form:"want"`
}

type SuggestionQueryParam struct {
	UUID string `form:"uuid"`
}
type PaginatedResponse struct {
	Content []map[string]interface{} `json:"content"`
	Next    string                   `json:"next,omitempty"`
}

func QueryMedia(c *gin.Context) error {
	var param MediaQueryParam
	if c.BindQuery(&param) != nil {
		c.Status(400)
		return nil
	}

	var wantattributes []string = strings.Split(param.Want, "-")

	validattrpassedin := serverutils.Filter(wantattributes, func(str string) bool {
		return serverutils.ListContain(ValidMediaAttributes, str)
	})

	selectstatement := serverutils.BuildSQL(ValidMediaAttributes, validattrpassedin)

	pgconn := serverutils.Postgrespool

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := fmt.Sprintf(`
		SELECT %s FROM galleryindex.images
		ORDER BY uploaded_at DESC
		LIMIT $2
		OFFSET $1
	`, selectstatement)

	// fmt.Print(query)
	rows, err := pgconn.Query(ctx, query, param.Offset, param.Limit)

	if err != nil {
		log.Fatalf("query fails %s", err)
	}

	var qresult []map[string]interface{}
	for rows.Next() {
		newval, _ := rows.Values()

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

		qresult = append(qresult, rowmap)
	}

	var nextURL string
	if len(qresult) == param.Limit {
		nextURL = fmt.Sprintf("/gms/media?offset=%d&limit=%d&want=%s", param.Offset+param.Limit, param.Limit, param.Want)
	}

	c.JSON(200, PaginatedResponse{
		Content: qresult,
		Next:    nextURL,
	})

	return nil
}

type MediaAdvancedQueryParam struct {
	Offset  int    `json:"offset"`
	Limit   int    `json:"limit"`
	Want    string `json:"want"`
	OrderBy []struct {
		Order string `json:"order"`
		By    string `json:"by"`
	} `json:"orderby"`
	TextSemanticSearch string `json:"text_sem_search"`
}

func QueryMediaRelated(c *gin.Context) error {
	var param SuggestionQueryParam

	if c.BindQuery(&param) != nil {
		c.Status(400)
		return nil
	}
	scorethreshold := float32(0.5)
	limit := uint64(20)
	points, err := serverutils.Qdrantclient.Query(context.Background(), &qdrant.QueryPoints{
		CollectionName: "media",
		Query:          qdrant.NewQueryID(qdrant.NewID(param.UUID)),
		ScoreThreshold: &scorethreshold,
		Limit:          &limit,
	})

	if err != nil {
		fmt.Println("Error query db")
		panic(err)
	}

	fmt.Println("Query results: ", points)

	c.JSON(200, points)

	return nil
}

func AdvancedMediaQuery(c *gin.Context) error {
	var param MediaAdvancedQueryParam
	if c.BindJSON(&param) != nil {
		c.Status(400)
		return nil
	}

	return errors.New("Function not defined")
}
