package AuthHandler

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type IDPostgresQuerrier interface {
	Query(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error)
}
