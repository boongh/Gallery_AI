package collection

import (
	"MediaServer/serverutils"
	"context"
	"time"

	"github.com/gin-gonic/gin"
)

func CollectionPermCheckMiddleware() gin.HandlerFunc {

	return func(c *gin.Context) {

		useruuid, _ := c.Get("userUUID")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		rows, pqerr := serverutils.Postgrespool.Query(ctx, `	
			SELECT permission
			FROM collections.collection_userperms
			WHERE collection_uuid = $1 AND user_uuid = $2
			LIMIT 1`, c.Param("collection_id"), useruuid)

		if pqerr != nil {
			c.Abort()
		}

		defer rows.Close()
		if !rows.Next() {
			c.Status(404)
			c.Abort()
		}

		var perms int16

		rows.Scan(&perms)

		c.Set("collection_perm_level", perms)
		c.Next()
	}
}
