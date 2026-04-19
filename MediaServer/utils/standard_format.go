package serverutils

type PaginatedResponse struct {
	Content []map[string]any `json:"content"`
	Next    string           `json:"next,omitempty"`
}

var ValidCollectionAttributes = []string{"uuid", "created_at", "name", "description", "metadata"}

var ValidMediaAttributes = []string{"uuid", "uuid::text", "format", "original_url", "thumbnail_url", "preview_url", "status", "created_at", "uploaded_at", "metadata"}
