package mediahandler

import (
	"MediaServer/serverutils"
	"context"
	"fmt"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/qdrant/go-client/qdrant"
)

type DeleteRequest struct {
	DeleteID []string `json:"delete_id"`
}

func DeleteMediaById(c *gin.Context) error {
	uuid, exist := c.Get("userUUID")

	if !exist {
		c.Status(400)
		return fmt.Errorf("userUUID not exists")
	}

	var delBody DeleteRequest
	err := c.BindJSON(&delBody)

	if err != nil {
		c.Status(400)
		return fmt.Errorf("Incorrect format : %s", err)
	}

	query := `
		DELETE FROM galleryindex.images
		WHERE uuid = ANY($1) AND owner_uuid = $2`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = serverutils.Postgrespool.Exec(ctx, query, delBody.DeleteID, uuid)

	if err != nil {
		c.Status(400)
		return fmt.Errorf("Error deleting from Postgres %s", err)
	}

	_, err = serverutils.Qdrantclient.Delete(context.Background(), &qdrant.DeletePoints{
		CollectionName: "media",
		Points: &qdrant.PointsSelector{
			PointsSelectorOneOf: &qdrant.PointsSelector_Filter{
				Filter: &qdrant.Filter{
					Must: []*qdrant.Condition{{
						ConditionOneOf: &qdrant.Condition_HasId{
							HasId: &qdrant.HasIdCondition{
								HasId: serverutils.Map(delBody.DeleteID, func(in string) *qdrant.PointId {
									return qdrant.NewID(in)
								}),
							},
						},
					},
						{
							ConditionOneOf: &qdrant.Condition_Field{
								Field: &qdrant.FieldCondition{
									Key: "owner_uuid",
									Match: &qdrant.Match{
										MatchValue: &qdrant.Match_Text{
											Text: uuid.(string),
										},
									},
								},
							},
						},
					},
				},
			},
		}},
	)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("Error deleting from qdrant %s", err)
	}

	c.Status(204)

	return nil
}
