package main

import (
	AuthHandler "MediaServer/auth"
	"MediaServer/collection"
	"MediaServer/mediahandler"
	"MediaServer/serverutils"
	"log"

	"github.com/gin-gonic/gin"
)

// @Summary		Get media file by ID
// @Description	Retrieve a media file by its UUID and type. Returns the file via X-Accel-Redirect (served by nginx). Returns 403 if the authenticated user does not own the media.
// @Tags			Query
// @Param			type	path	string	true	"Media type (e.g. thumbnail, original)"
// @Param			id		path	string	true	"UUID of the media item"
// @Produce		application/octet-stream
// @Success		200
// @Failure		403
// @Failure		404
// @Router			/gms/media/{type}/{id} [GET]
func GET_MediaID(c *gin.Context) {
	err := mediahandler.GetMediaByID(c, serverutils.Postgrespool)
	if err != nil {
		log.Printf("Failed to retrieve media:%s", err)
		c.Status(500)
	}
}

// @Summary		Upload images
// @Description	Upload images via form data in the field "files"
// @Tags			Creation
// @Accept			multipart/form-data
// @Produce		text/plain
// @Success		200
// @Router			/gms/media [POST]
func POST_MediaUpload(c *gin.Context) {
	err := mediahandler.MediaUploadHandler(c, serverutils.Postgrespool, serverutils.Postgrespool)
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
func GET_MediaQuery(c *gin.Context) {
	err := mediahandler.QueryMedia(c, serverutils.Postgrespool)
	if err != nil {
		log.Println("Media Query Fail:", err)
		c.Status(500)
	}
}

// @Summary		Query media
// @Description	Query for by word or filter
// @Tags			Query
// @Param			text_query query string false "Text to search for"
// @Produce		application/json
// @Success		200
// @Router			/gms/media/query [POST]
func POST_MediaAdvancedQuery(c *gin.Context) {
	err := mediahandler.AdvancedMediaQuery(c)
	if err != nil {
		log.Println("Advanced Media Query Fail:", err)
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
func GET_MediaQueryRelated(c *gin.Context) {

	err := mediahandler.QueryMediaRelated(c, serverutils.Postgrespool)
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
func MediaQuerySearch(c *gin.Context) {
	err := collection.NewCollectionHandler(c)
	if err != nil {
		log.Println("Collection Creation Failed:", err)
		c.Status(500)
	}
}

// @Summary		Register a new user
// @Description	Create a new user account with a username and password. Also creates a default collection for the user. Returns 201 on success.
// @Tags			Auth
// @Accept			application/json
// @Param			credentials	body	AuthHandler.UserCredential	true	"Username and password"
// @Success		201
// @Failure		400
// @Failure		500
// @Router			/signup [POST]
func POST_UserSignup(c *gin.Context) {
	err := AuthHandler.Auth_Post_Signup_Handler(c, serverutils.Postgrespool)
	if err != nil {
		log.Println("User Signup Failed:", err)
		c.Status(500)
	}
}

// @Summary		Log in
// @Description	Authenticate with username and password. Sets an HttpOnly cookie named auth_token (JWT, 7-day expiry) on success and returns the user UUID.
// @Tags			Auth
// @Accept			application/json
// @Produce		application/json
// @Param			credentials	body	AuthHandler.UserCredential	true	"Username and password"
// @Success		200	{object}	map[string]string	"userid field contains the user UUID"
// @Failure		400
// @Failure		401
// @Failure		500
// @Router			/login [POST]
func POST_UserLogin(c *gin.Context) {
	err := AuthHandler.Auth_Post_Login_Handler(c, serverutils.Postgrespool)
	if err != nil {
		log.Println("User Login Failed:", err)
		c.Status(500)
	}
}

// @Summary		Get current user info
// @Description	Returns the authenticated user's UUID, username, and account creation timestamp. Requires a valid auth_token cookie.
// @Tags			Auth
// @Produce		application/json
// @Success		200	{object}	map[string]interface{}	"uuid, username, created_at"
// @Failure		401
// @Failure		404
// @Failure		500
// @Router			/auth/me [GET]
func GET_AuthMe(c *gin.Context) {
	AuthHandler.Auth_Get_Me_Handler(c, serverutils.Postgrespool)
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
