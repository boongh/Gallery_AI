package main

import (
	"MediaServer/serverutils"
	"fmt"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

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
	err := godotenv.Load()

	if err != nil {
		log.Fatal(fmt.Errorf(".env load fail %s", err))
	} else {
		log.Println(".env load successful")
	}

	// Create a Gin router with default middleware (logger and recovery)
	server := gin.Default()
	server.MaxMultipartMemory = (8 << 20)

	pgconnection := serverutils.PostgresConnect()
	rbmqconnect, rbmqchannel, _ := serverutils.RabbitMQConnect("")

	defer pgconnection.Close()
	defer rbmqconnect.Close()
	defer rbmqchannel.Close()

	//End init

	// Define a simple GET endpoint
	server.GET("/ping", func(c *gin.Context) {
		// Return JSON response
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	//Upload
	{
		uploadgroup := server.Group("/media")
		uploadgroup.POST("", mediaupload)
		uploadgroup.GET("", MediaQuery)
	}

	{
		colgroup := server.Group("/collection")
		colgroup.GET("", CollectionQueryHandler)
		colgroup.POST("", CollectionCreationHandler)
	}

	server.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	if err := server.Run(":8080"); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
