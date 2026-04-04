package main

import (
	"MediaServer/collection"
	"MediaServer/mediahandler"
	"log"

	"github.com/gin-gonic/gin"
)

// @Summary		Upload images
// @Description	Upload images via form data in the field "files"
// @Tags			Creation
// @Accept			multipart/form-data
// @Produce		text/plain
// @Success		200
// @Router			/gms/media [POST]
func mediaupload(c *gin.Context) {
	err := mediahandler.MediaUploadHandler(c)
	if err != nil {
		log.Println("Image Upload Fail:", err)
		c.Status(500)
	}
}

// @Summary		Query for media test for changs
// @Description	Query for media available to a user
// @Tags			Query
// @Param			offset query int false "Offset from the first of an ordered list"
// @Param			limit query int false "Limit the number of entries returned"
// @Param			order query string false "Which order is it in"
// @Param			by query string false "Which attribute are the entries ordered by"
// @Param			want query string false "Which attributes are wanted in the response"
// @Produce		application/json
// @Success		200
// @Router			/gms/media [GET]
func MediaQuery(c *gin.Context) {
	err := mediahandler.QueryMedia(c)
	if err != nil {
		log.Println("Media Query Fail:", err)
		c.Status(500)
	}
}

// @Summary		Get media suggestions
// @Description	Query for media similar to a specified uuid
// @Tags			Query
// @Param			uuid query int false "uuid of the root media"
// @Produce		application/json
// @Success		200
// @Router			/gms/media/suggestions [GET]
func MediaQueryRelated(c *gin.Context) {
	err := mediahandler.QueryMediaRelated(c)
	if err != nil {
		log.Println("Media Query Fail:", err)
		c.Status(500)
	}
}

// @Summary		Create a new collection
// @Description	Create a new collection entry with a specified name and description
// @Tags			Creation
// @Param			collection	body	collection.NewCollection	true	"The collection data to create"
// @Produce		application/json
// @Success		200	{object}	collection.NewCollection	//	Example	success	response
// @Router			/gms/collection [POST]
func CollectionCreationHandler(c *gin.Context) {
	err := collection.NewCollectionHandler(c)
	if err != nil {
		log.Println("Collection Creation Failed:", err)
		c.Status(500)
	}
}

// @Summary		Query for available collections
// @Description	Query for all available collections to a specific user by the parameter specified
// @Tags			Query
// @Param	want query string true "What attributes are wanted in the response"
// @Param	offset query int false "Offsets from the first response table order"
// @Param	limit query int false "How many entries is wanted in the response"
// @Produce		text/plain
// @Success		200
// @Router			/gms/collection [GET]
func CollectionQueryHandler(c *gin.Context) {
	err := collection.CollectionQuery(c)
	if err != nil {
		log.Println("Collection Query Fail:", err)
		c.Status(500)
	}
}
