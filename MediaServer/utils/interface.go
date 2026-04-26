package serverutils

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type ImagePostgresInserter interface {
	CopyFrom(ctx context.Context, tableName pgx.Identifier, columnNames []string, rowSrc pgx.CopyFromSource) (int64, error)
}

type PostgresQuerier interface {
	Query(ctx context.Context, query string, args ...interface{}) (pgx.Rows, error)
}

type PostgresExecer interface {
	Exec(ctx context.Context, query string, args ...interface{}) (pgconn.CommandTag, error)
}
