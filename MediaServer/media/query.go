package mediahandler

import (
	"MediaServer/serverutils"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"net/http"

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
type MediaAdvancedQueryParam struct {
	Offset  uint64 `json:"offset"`
	Limit   uint64 `json:"limit"`
	Want    string `json:"want"`
	OrderBy []struct {
		Order string `json:"order"`
		By    string `json:"by"`
	} `json:"orderby"`
	TextQuery  string      `json:"text_query"`
	PointQuery [][]float32 `json:"point_query"`
}

type MediaAdvancedQueryResponse struct {
	Content struct {
		Elapsed float64     `json:"elapsed_time"`
		Vector  [][]float32 `json:"vector"`
	} `json:"content"`
}
type AdvancedQueryContent struct {
	Results []map[string]interface{} `json:"results"`
}

type AdvancedQueryPaginatedResponse struct {
	Content AdvancedQueryContent    `json:"content"`
	Next    MediaAdvancedQueryParam `json:"next,omitempty"`
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

	// fmt.Println("Query results: ", points)

	c.JSON(200, points)

	return nil
}

func AdvancedMediaQuery(c *gin.Context) error {
	var param MediaAdvancedQueryParam
	var queryvectors []*qdrant.VectorInput
	err := c.Bind(&param)
	if err != nil {
		c.Status(400)
		return fmt.Errorf("Error binding JSON: %v", err)
	}

	if param.Limit == 0 {
		param.Limit = 20
	}
	if param.TextQuery == "" && len(param.PointQuery) == 0 {
		c.Status(400)
		return fmt.Errorf("No query provided")
	}
	// param.TextQuery = "Female portrait, high quality, detailed, artstation"
	var vectorembeddings [][]float32

	//Query points directly takes precedence over text query

	if len(param.PointQuery) > 0 {
		for _, vector := range param.PointQuery {
			queryvectors = append(queryvectors, qdrant.NewVectorInput(vector...))
		}
		vectorembeddings = param.PointQuery
	} else {

		value := map[string]interface{}{
			"texts_query": strings.Split(param.TextQuery, ","),
		}

		jsonvalue, err := json.Marshal(value)

		if err != nil {
			return fmt.Errorf("json marshal fail: %v", err)
		}

		res, err := http.Post(
			"http://python-worker:8001/embed/text",
			"application/json",
			bytes.NewBuffer(jsonvalue),
		)

		if err != nil {
			return fmt.Errorf("POST fail: %v", err)
		}

		// fmt.Println("Raw embedding response: ", res)

		defer res.Body.Close()

		var responseobj MediaAdvancedQueryResponse

		err = json.NewDecoder(res.Body).Decode(&responseobj)

		if err != nil {
			return fmt.Errorf("Body parse fail: %v", err)
		}

		// fmt.Println("Parsed embedding response vector: ")
		for _, vector := range responseobj.Content.Vector {
			queryvectors = append(queryvectors, qdrant.NewVectorInput(vector...))
		}
		vectorembeddings = responseobj.Content.Vector
	}

	points, err := serverutils.Qdrantclient.Query(context.Background(), &qdrant.QueryPoints{
		CollectionName: "media",
		Query: qdrant.NewQueryRecommend(&qdrant.RecommendInput{
			Positive: queryvectors,
			// Negative: []*qdrant.VectorInput{
			// 	qdrant.NewVectorInput(0.01, 0.45, 0.67),
			// },
		}),
		// Query:          qdrant.NewQueryNearest(qdrant.NewVectorInput(responseobj.Content.Vector...)),
		Offset: &param.Offset,

		Limit: &param.Limit,
	})

	if err != nil {
		return fmt.Errorf("Qdrant fail: %v", err)
	}

	results := make([]map[string]interface{}, len(points))
	for i, p := range points {
		results[i] = map[string]interface{}{
			"id":      p.Id.GetUuid(),
			"score":   p.Score,
			"payload": p.Payload,
		}
	}

	var nextQuery MediaAdvancedQueryParam = param
	if uint64(len(points)) == param.Limit {
		nextQuery = MediaAdvancedQueryParam{
			PointQuery: vectorembeddings,
			Offset:     param.Offset + param.Limit,
		}
	}

	c.JSON(200, AdvancedQueryPaginatedResponse{
		Content: AdvancedQueryContent{
			Results: results,
		},
		Next: nextQuery,
	})

	return nil
}
