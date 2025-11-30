package serverutils

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	amqp "github.com/rabbitmq/amqp091-go"
)

var Postgrespool *pgxpool.Pool
var Rabbitmqconnection *amqp.Connection
var Rabbitmqchannel *amqp.Channel

func PostgresConnect() *pgxpool.Pool {
	return FailOnError(func() (*pgxpool.Pool, error) {
		pool, err := pgxpool.New(context.Background(),
			fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
				os.Getenv("PGUSER"),
				os.Getenv("PGPASSWORD"),
				os.Getenv("PGHOST"),
				os.Getenv("PGPORT"),
				os.Getenv("PGDATABASE")))

		Postgrespool = pool
		return pool, err
	}, "", "failed to connect to postgres", context.Background())
}

func RabbitMQConnect(queue string) (*amqp.Connection, *amqp.Channel, amqp.Queue) {
	conn := FailOnError(func() (*amqp.Connection, error) {
		return amqp.Dial(fmt.Sprintf("amqp://%s:%s@%s:%s/",
			os.Getenv("RABBITUSER"),
			os.Getenv("RABBITPASSWORD"),
			os.Getenv("RABBITHOST"),
			os.Getenv("RABBITPORT"),
		))
	}, "", "failed to connect to rabbitmq", context.Background())

	channel := FailOnError(func() (*amqp.Channel, error) {
		return conn.Channel()
	}, "", "failed to connecto to channel", context.Background())

	var q amqp.Queue
	if queue != "" {
		q = FailOnError(func() (amqp.Queue, error) {
			return channel.QueueDeclare(
				queue, // name
				true,  // durable
				false, // delete when unused
				false, // exclusive
				false, // no-wait
				nil,   // arguments
			)
		}, "", "failed to initialize queue", context.Background())
	}

	Rabbitmqconnection = conn
	Rabbitmqchannel = channel

	return conn, channel, q
}
