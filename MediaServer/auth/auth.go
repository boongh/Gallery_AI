package AuthHandler

import (
	"MediaServer/serverutils"
	"context"
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type UserCredential struct {
	Username string `json:"username" binding:"required" omitempty:"true"`
	Password string `json:"password" binding:"required"`
}

type CredentialQuerrier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type CredentialInserter interface {
	CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error)
}

type TestCredentialQuerrier struct {
}

type TestCredentialRow struct {
}

type TestCredentialInserter struct {
}

func (r *TestCredentialRow) Scan(dest ...any) error {
	dest[0] = "test-uuid"
	dest[1] = "test-salt"
	dest[2] = "test-password-hash"
	return nil
}

func (q *TestCredentialQuerrier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return &TestCredentialRow{}
}

func (i *TestCredentialInserter) CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error) {
	return 1, nil
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		err := Auth_Get_Validate_Handler(c)
		if err != nil {
			fmt.Println("Unauthorized access attempt:", err)
			c.Redirect(302, "/login")
			c.Abort()
			return
		} else {
			c.Next()
		}
	}
}

func Auth_Post_Signup_Handler(c *gin.Context, inserter CredentialInserter) error {
	var creds UserCredential

	if c.ShouldBindJSON(&creds) != nil {
		c.Status(400)
		return fmt.Errorf("invalid request body")
	}

	entries := [][]any{}
	var username string
	var useruuid = uuid.New()
	if creds.Username != "" {
		username = creds.Username
	}
	salt := uuid.New().String()
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(creds.Password+salt), bcrypt.DefaultCost+2)
	if err != nil {
		c.Status(500)
		return fmt.Errorf("Error hashing password %s", err)
	}

	entries = append(entries, []any{useruuid, username, salt, string(passwordHash[:]), time.Now()})
	fmt.Println(creds)
	fmt.Println(entries)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := inserter.CopyFrom(
		ctx,
		pgx.Identifier{"users", "credentials"},
		[]string{"uuid", "username", "salt", "password_hash", "created_at"},
		pgx.CopyFromRows(entries))

	if err != nil || rows != 1 {
		c.Status(500)
		return fmt.Errorf("Error inserting user into database %s", err)
	}

	rows, err = inserter.CopyFrom(
		ctx,
		pgx.Identifier{"collections", "collection_data"},
		[]string{"uuid", "owner_uuid", "name"},
		pgx.CopyFromRows([][]any{{useruuid, useruuid, "Default"}}))

	if err != nil || rows != 1 {
		//Make sure no rogue users allowed
		serverutils.Postgrespool.Exec(ctx, "DELETE FROM users.credentials WHERE uuid=$1", useruuid)

		c.Status(500)

		return fmt.Errorf("Error inserting user collections into database %s", err)
	}

	c.Status(201)
	return nil
}

func Auth_Post_Login_Handler(c *gin.Context, querrier CredentialQuerrier) error {
	// "serverutils.Postgrespool"
	var creds UserCredential

	if c.ShouldBindJSON(&creds) != nil {
		c.Status(400)
		return fmt.Errorf("invalid request body")
	}

	var salt string
	var passwordHash string
	var userUUID string
	err := querrier.QueryRow(context.Background(), "SELECT uuid, salt, password_hash FROM users.credentials WHERE username=$1", creds.Username).Scan(&userUUID, &salt, &passwordHash)

	if err != nil {
		c.Status(401)
		return fmt.Errorf("invalid username or password")
	}

	err = bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(creds.Password+salt))
	if err != nil {
		c.Status(401)
		return fmt.Errorf("invalid username or password")
	}

	// Generate and return a token
	claims := jwt.RegisteredClaims{
		Subject:   userUUID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour * 7)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "GalleryAI",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	secure := os.Getenv("PRODUCTION") == "true"
	secretKey := os.Getenv("JWT_SECRET_KEY")
	signingkey, err := token.SignedString([]byte(secretKey))

	if err != nil {
		c.Status(500)
		return fmt.Errorf("Error generating token %s", err)
	}

	c.SetCookie("auth_token", signingkey, 3600*24*7, "/", "", secure, true)
	c.JSON(200, gin.H{"userid": userUUID})

	return nil
}

func Auth_Get_Me_Handler(c *gin.Context, q IDPostgresQuerrier) error {
	uuid, exists := c.Get("userUUID")

	if !exists {
		c.Status(401)
		return fmt.Errorf("Unauthorized: No UUID")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	query := `
		SELECT username, created_at 
		FROM users.credentials
		WHERE uuid = $1`

	rows, err := q.Query(ctx, query, uuid)

	if err != nil {
		c.Status(500)
		return fmt.Errorf("query fails %s", err)
	}

	defer rows.Close()

	if !rows.Next() {
		c.Status(404)
		return nil
	}

	var username string
	var created_at time.Time

	rows.Scan(&username, created_at)

	c.JSON(200, gin.H{"uuid": uuid,
		"username":   username,
		"created_at": created_at})

	return nil
}

func Auth_Get_Validate_Handler(c *gin.Context) error {
	tokenStr, err := c.Cookie("auth_token")
	if err != nil {
		c.Status(401)
		return fmt.Errorf("Unauthorized: No token provided")
	}

	secretKey := os.Getenv("JWT_SECRET_KEY")
	token, err := jwt.ParseWithClaims(tokenStr, &jwt.RegisteredClaims{}, func(token *jwt.Token) (any, error) {
		return []byte(secretKey), nil
	})

	if err != nil || !token.Valid {
		c.Status(401)
		return fmt.Errorf("Unauthorized: Invalid token")
	}

	var uuid string
	if claims, ok := token.Claims.(*jwt.RegisteredClaims); ok {
		uuid = claims.Subject
		c.Set("userUUID", uuid)
	}

	return nil
}
