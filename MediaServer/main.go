package main

import (
	"MediaServer/collection"
	"MediaServer/serverutils"
	"bg_workers"
	"context"
	"db"
	"time"

	// "fmt"
	AuthHandler "MediaServer/auth"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	// "github.com/joho/godotenv"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "server/docs"
)

//@title Media Server API
//@version 0.1
//@description API for interacting with the media server
//@scheme http

func main() {
	//Init
	log.SetPrefix("Server:")
	log.SetFlags(0b11110)
	// err := godotenv.Load()

	// if err != nil {
	// 	log.Fatal(fmt.Errorf(".env load fail %s", err))
	// } else {
	// 	log.Println(".env load successful")
	// }

	// Create a Gin router with default middleware (logger and recovery)

	pgconnection := serverutils.PostgresConnect()
	rbmqconnect, rbmqchannel, _ := serverutils.RabbitMQConnect("")
	serverutils.QdrantConnect()
	serverutils.S3Connect()

	db.RunMigrations(pgconnection)

	go bg_workers.DBSyncToStorageJob(context.Background(), time.NewTicker(5*time.Minute), serverutils.Postgrespool, serverutils.Postgrespool, serverutils.S3client)
	go bg_workers.VectorSyncToDBJob(context.Background(), time.NewTicker(1*time.Hour), serverutils.Postgrespool)
	bg_workers.StartThumbnailWorker("thumbnail_preview_generation_queue")

	defer pgconnection.Close()
	defer rbmqconnect.Close()
	defer rbmqchannel.Close()

	server := gin.Default()
	server.MaxMultipartMemory = (8 << 20)

	//End init

	// Define a simple GET endpoint
	server.GET("/ping", func(c *gin.Context) {
		// Return JSON response
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	{
		server.POST("/signup", POST_UserSignup)
		server.POST("/login", POST_UserLogin)
	}

	protected := server.Group("/")
	protected.Use(AuthHandler.AuthMiddleware())
	//Upload

	{
		authgroup := protected.Group("/auth")
		authgroup.GET("/me", GET_AuthMe)
	}

	{
		uploadGroup := protected.Group("/upload")
		uploadGroup.GET("/init", GET_MediaUploadInit)
		uploadGroup.PUT("/verify/:upload_id", PUT_MediaUploadVerify)
	}

	{
		mediagroup := protected.Group("/media")
		mediagroup.GET("", GET_MediaQuery)
		mediagroup.GET("/:type/:id", GET_MediaID)
		mediagroup.GET("/suggestions", GET_MediaQueryRelated)

		mediagroup.POST("/delete", POST_DeleteMedias)
		mediagroup.POST("/query", POST_MediaAdvancedQuery)

	}

	{
		colgroup := protected.Group("/collection")
		colgroup.GET("", GET_GetAvailCollection)
		colgroup.POST("", POST_CreateNewCollection)
		{

			colIDgroup := colgroup.Group("/:collection_id")
			colIDgroup.Use(collection.CollectionPermCheckMiddleware())

			colIDgroup.GET("", GET_GetCollectionByID)
			colIDgroup.DELETE("", DELETE_CollectionByID)
			colIDgroup.POST("", POST_CollectionInsert)
			colIDgroup.GET("/contents", GET_GetCollectionContent)
		}
	}

	server.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	if err := server.Run(":8080"); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
