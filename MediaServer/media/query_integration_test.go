//go:build integration

// Build tag means this file is IGNORED by default.
// Run with: go test -tags=integration ./media/...
//
// This requires a real Postgres instance. Set these env vars before running:
//   PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE
//
// In CI, you'd run a postgres container and set these to point at it.

package mediahandler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	mediahandler "MediaServer/media"
	"MediaServer/serverutils"

	"github.com/gin-gonic/gin"
)

// TestMain runs ONCE before all tests in this package.
// It's the right place to set up shared resources like DB connections.
//
// Without TestMain, each test would try to connect to Postgres itself,
// which is slow and makes teardown messy.
func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)

	// Connect to the real Postgres. This reads PGUSER, PGHOST, etc. from env.
	serverutils.PostgresConnect()

	// m.Run() executes all Test* functions in this package.
	// os.Exit ensures the process exits with the right code (0 = pass, 1 = fail).
	os.Exit(m.Run())
}

// buildRouter wires up a minimal Gin router with just the one route we're testing.
// We don't start the full server — we only need the handler under test.
func buildRouter() *gin.Engine {
	router := gin.New() // gin.New() skips the default logger, keeping test output clean
	router.GET("/media", func(c *gin.Context) {
		err := mediahandler.QueryMedia(c)
		if err != nil {
			c.Status(500)
		}
	})
	return router
}

// TestQueryMedia_ReturnsOK is the baseline integration test:
// "does the endpoint return 200 at all?"
//
// This catches wiring bugs — wrong SQL table name, broken DB connection, etc.
// It does NOT assert on specific data because a test DB may be empty.
func TestQueryMedia_ReturnsOK(t *testing.T) {
	router := buildRouter()

	// httptest.NewRequest builds a fake *http.Request — no network involved.
	req := httptest.NewRequest(http.MethodGet, "/media?offset=0&limit=10&want=uuid-format", nil)

	// httptest.NewRecorder() captures what the handler writes (status, headers, body).
	w := httptest.NewRecorder()

	// ServeHTTP runs the request through the router synchronously, right here in the test.
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d\nbody: %s", w.Code, w.Body.String())
	}
}

// TestQueryMedia_ResponseIsValidJSON verifies the response shape.
// Even if the DB is empty, it must return {"content": [], "next": ""} — not garbage.
func TestQueryMedia_ResponseIsValidJSON(t *testing.T) {
	router := buildRouter()

	req := httptest.NewRequest(http.MethodGet, "/media?offset=0&limit=5&want=uuid-format", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// Decode into the same struct QueryMedia writes — proves the JSON shape is stable.
	var body mediahandler.PaginatedResponse
	err := json.NewDecoder(w.Body).Decode(&body)
	if err != nil {
		t.Fatalf("response body is not valid JSON: %v\nbody was: %s", err, w.Body.String())
	}

	// Content must never be nil — an empty DB should give [], not null.
	if body.Content == nil {
		t.Error("expected Content to be an empty slice, got nil")
	}
}

// TestQueryMedia_BadRequest_Returns400 verifies that a malformed request
// is rejected cleanly. This is a contract test — callers need to know what
// a bad request looks like.
func TestQueryMedia_InvalidWantParam_StillReturns200(t *testing.T) {
	router := buildRouter()

	// "want" contains a column that doesn't exist — BuildSQL should filter it out
	// and the query should still succeed (with fewer columns).
	req := httptest.NewRequest(http.MethodGet, "/media?offset=0&limit=5&want=uuid-fakecolumn", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// The server should not crash or 500 — invalid columns are silently dropped by BuildSQL.
	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for unknown column, got %d\nbody: %s", w.Code, w.Body.String())
	}
}

// TestQueryMedia_PaginationNextURL verifies that when the result set fills the limit,
// the response includes a "next" URL for the caller to paginate with.
//
// NOTE: This test only works if the test DB has >= 2 rows in galleryindex.images.
// Skip it if the DB is empty, or seed it in TestMain.
func TestQueryMedia_PaginationNextURL(t *testing.T) {
	router := buildRouter()

	// Request with limit=1 — if there are any rows, next should be populated.
	req := httptest.NewRequest(http.MethodGet, "/media?offset=0&limit=1&want=uuid", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var body mediahandler.PaginatedResponse
	json.NewDecoder(w.Body).Decode(&body)

	// Only assert the Next URL format IF we got results back.
	// If the DB is empty, this assertion is skipped — not failed.
	if len(body.Content) == 1 && body.Next == "" {
		t.Error("got a full page of results but Next URL was empty")
	}
}
