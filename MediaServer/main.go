package main

import (
	"fmt"
	"log"
	"net/http"

	"apihandler.com/upload"
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

// @Summary		Upload images
// @Schemes		http
// @Description	Upload images via form data in the field "files"
// @Tags			Upload
// @Accept			multipart/form-data
// @Produce		text/plain
// @Success		200
// @Router			/gms/upload/images [POST]
func imgupload(c *gin.Context) {
	err := upload.ImageUploadHandler(c)
	if err != nil {
		log.Println("Image Upload Fail:", err)
		c.Status(500)
	}
}

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

	//End init

	// Define a simple GET endpoint
	server.GET("/ping", func(c *gin.Context) {
		// Return JSON response
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	//Upload
	server.POST("/upload/images", imgupload)

	server.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	if err := server.Run(":8080"); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
