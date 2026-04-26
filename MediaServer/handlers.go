package main

import (
	AuthHandler "MediaServer/auth"
	"MediaServer/collection"
	"MediaServer/mediahandler"
	"MediaServer/serverutils"
	"log"

	"github.com/gin-gonic/gin"
)

// @Summary		Get presigned URL for a media item
// @Description	Returns a short-lived presigned S3 GET URL for the requested media item. Valid types: thumbnails, previews, originals. URL expires after 5 minutes. Returns 403 if the authenticated user does not own the media.
// @Tags			Query
// @Param			type	path	string	true	"Media type (thumbnails | previews | originals)"
// @Param			id		path	string	true	"UUID of the media item"
// @Produce		text/plain
// @Success		200	{string}	string	"Presigned S3 GET URL (5-minute TTL)"
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

// @Summary		Delete media by ID
// @Description	Delete one or more images owned by the authenticated user. Only images whose owner_uuid matches the caller are deleted. Returns 204 on success.
// @Tags			Deletion
// @Accept			application/json
// @Param			body	body	mediahandler.DeleteRequest	true	"List of image UUIDs to delete"
// @Success		204
// @Failure		400
// @Failure		500
// @Router			/media/delete [POST]
func POST_DeleteMedias(c *gin.Context) {
	err := mediahandler.DeleteMediaById(c)
	if err != nil {
		log.Printf("Failed to delete media:%s", err)
		c.Status(500)
	}
}

// @Summary		Initialize a presigned upload session
// @Description	Returns N presigned S3 PUT URLs and an upload_id. Client uploads files directly to S3 using the presigned URLs, then calls PUT /upload/verify/:upload_id. Session expires in 15 minutes.
// @Tags			Upload
// @Param			count	query	int	false	"Number of files to upload (default 1, max 1000)"
// @Produce		application/json
// @Success		200	{object}	object{upload_id=string,presigned_urls=[]string,expiration=string}
// @Failure		500
// @Router			/upload/init [GET]
func GET_MediaUploadInit(c *gin.Context) {
	err := mediahandler.MediaUploadInit(c, serverutils.S3client, serverutils.Postgrespool)
	if err != nil {
		log.Println("Media Upload Init Fail:", err)
		c.Status(500)
	}
}

// @Summary		Verify a presigned upload session
// @Description	Checks which files from the upload session have landed in S3 and promotes them to pending processing status. Processing starts within 5 minutes via the background sync job.
// @Tags			Upload
// @Param			upload_id	path	string	true	"Upload session ID from /upload/init"
// @Success		200
// @Failure		404	{string}	string	"Session not found or expired"
// @Router			/upload/verify/{upload_id} [PUT]
func PUT_MediaUploadVerify(c *gin.Context) {
	err := mediahandler.MediaUploadVerify(c, serverutils.Postgrespool)
	if err != nil {
		log.Println("Media Upload Complete Fail:", err)
		c.Status(500)
	}
}

// @Summary		Query media
// @Description	Returns a paginated list of media items owned by the authenticated user. Results do not include URLs — use GET /media/{type}/{id} to fetch a presigned URL per item.
// @Tags			Query
// @Param			offset	query	int		false	"Number of entries to skip"
// @Param			limit	query	int		false	"Maximum number of entries to return"
// @Param			want	query	string	false	"Dash-separated list of fields: uuid, format, created_at, uploaded_at, metadata"
// @Produce		application/json
// @Success		200	{object}	serverutils.PaginatedResponse
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

const collectionpathroot string = "/gms/collections"
const ownerpermlevel int16 = 32767
const basicviewerpermlevel int16 = 10
const contentviewerpermlevel int16 = 20
const contenteditorpermlevel int16 = 30
const inforeditorpermlevel int16 = 40

// @Summary		List available collections
// @Description	Returns a paginated list of all collections the authenticated user has any level of access to, ordered by creation date descending.
// @Tags			Query
// @Produce		application/json
// @Param			offset	query	int	false	"Number of entries to skip"
// @Param			limit	query	int	false	"Maximum number of entries to return"
// @Success		200	{object}	serverutils.PaginatedResponse	"content array of { uuid, created_at, name, description, thumbnail_uuid }"
// @Failure		400
// @Failure		500
// @Router			/gms/collection [GET]
func GET_GetAvailCollection(c *gin.Context) {
	err := collection.GetAvailCollections(c, collectionpathroot)
	if err != nil {
		log.Println("Collection Querying Failed:", err)
		c.Status(500)
	}
}

// @Summary		Create a new collection
// @Description	Creates a new collection owned by the authenticated user. Returns 201 with the new collection UUID as plain text.
// @Tags			Creation
// @Accept			application/json
// @Produce		text/plain
// @Param			body	body	collection.NewCollection	true	"Collection name, description, and optional thumbnail UUID"
// @Success		201
// @Failure		400
// @Failure		500
// @Router			/collection [POST]
func POST_CreateNewCollection(c *gin.Context) {
	err := collection.CollectionCreation(c, ownerpermlevel)
	if err != nil {
		log.Println("Collection Creation Failed:", err)
		c.Status(500)
	}
}

// @Summary		Get collection info by ID
// @Description	Returns full metadata for a single collection the user has access to. Returns 403 if the user lacks permission (requires at least basicviewerpermlevel).
// @Tags			Query
// @Produce		application/json
// @Param			collection_id	path	string	true	"UUID of the collection"
// @Success		200	{array}		map[string]interface{}	"Array of collection row maps"
// @Failure		403
// @Failure		404
// @Failure		500
// @Router			/collection/{collection_id} [GET]
func GET_GetCollectionByID(c *gin.Context) {
	err := collection.CollectionInfo(c, basicviewerpermlevel)
	if err != nil {
		log.Println("Collection Querying Failed:", err)
		c.Status(500)
	}
}

// @Summary		Delete a collection
// @Description	Permanently deletes a collection owned by the authenticated user. Requires owner-level permission. Returns 204 on success.
// @Tags			Deletion
// @Param			collection_id	path	string	true	"UUID of the collection"
// @Success		204
// @Failure		403
// @Failure		404
// @Failure		500
// @Router			/collection/{collection_id} [DELETE]
func DELETE_CollectionByID(c *gin.Context) {
	err := collection.CollectionDeletion(c, ownerpermlevel)
	if err != nil {
		log.Println("Collection Deletion Failed:", err)
		c.Status(500)
	}
}

// @Summary		Insert images into a collection
// @Description	Adds one or more images (by UUID) to an existing collection. The caller must own the images and have content-editor permission on the collection. Returns 201 on success.
// @Tags			Creation
// @Accept			application/json
// @Param			collection_id	path	string								true	"UUID of the collection"
// @Param			body			body	collection.CollectionUpsertDelFormat	true	"Array of image UUIDs to insert"
// @Success		201
// @Failure		400
// @Failure		403
// @Failure		500
// @Router			/collection/{collection_id} [POST]
func POST_CollectionInsert(c *gin.Context) {
	err := collection.CollectionContentInsert(c, contenteditorpermlevel)
	if err != nil {
		log.Println("Collection Insertion Failed:", err)
		c.Status(500)
	}
}

// @Summary		Get collection image contents
// @Description	Returns a paginated list of images belonging to the specified collection, ordered by date added. Supports `want`, `offset`, and `limit` query parameters. The `want` parameter is a dash-separated list of fields (e.g. `uuid-format-created_at-added_at`). Use GET /media/{type}/{uuid} to fetch presigned URLs per item. Requires content-viewer permission on the collection.
// @Tags			Query
// @Produce		application/json
// @Param			collection_id	path	string	true	"UUID of the collection"
// @Param			want			query	string	false	"Dash-separated list of fields to return (e.g. uuid-original_url-thumbnail_url)"
// @Param			offset			query	int		false	"Number of entries to skip"
// @Param			limit			query	int		false	"Maximum number of entries to return"
// @Success		200	{object}	serverutils.PaginatedResponse	"Paginated content array with optional next URL"
// @Failure		403
// @Failure		404
// @Failure		500
// @Router			/collection/{collection_id}/contents [GET]
func GET_GetCollectionContent(c *gin.Context) {
	err := collection.CollectionContentQuery(c, contentviewerpermlevel, collectionpathroot)
	if err != nil {
		log.Println("Collection Querying Failed:", err)
		c.Status(500)
	}
}
