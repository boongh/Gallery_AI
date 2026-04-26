package serverutils

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/qdrant/go-client/qdrant"
	amqp "github.com/rabbitmq/amqp091-go"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var Postgrespool *pgxpool.Pool
var Rabbitmqconnection *amqp.Connection
var Rabbitmqchannel *amqp.Channel
var Qdrantclient *qdrant.Client
var S3client *s3.Client
var S3PublicEndpoint = os.Getenv("S3_PUBLIC_ENDPOINT")
var S3Bucket = os.Getenv("S3_BUCKET")

func PostgresConnect() *pgxpool.Pool {
	return FailOnError(func() (*pgxpool.Pool, error) {
		pgport := os.Getenv("PGPORT")
		if pgport == "" {
			pgport = "5432"
		}
		pool, err := pgxpool.New(context.Background(),
			fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
				os.Getenv("PGUSER"),
				os.Getenv("PGPASSWORD"),
				os.Getenv("PGHOST"),
				pgport,
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

func QdrantConnect() *qdrant.Client {
	client := FailOnError(func() (*qdrant.Client, error) {
		port, _ := strconv.Atoi(os.Getenv("QDRANTPORT"))
		return qdrant.NewClient(&qdrant.Config{
			Host: os.Getenv("QDRANTHOST"),
			Port: port,
		})
	}, "", "failed to connect to qdrant", context.Background())

	Qdrantclient = client
	return client
}

func S3Connect() *s3.Client {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")

	fmt.Printf("S3 Endpoint: %s\n", endpoint)
	fmt.Printf("S3 ACCESS KEY: %s\n", accessKey)
	fmt.Printf("S3 SECRET KEY: %s\n", secretKey)
	fmt.Printf("S3 BUCKET: %s\n", S3Bucket)

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("us-east-1"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
		),
	)
	if err != nil {
		log.Fatal(err)
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	S3client = client

	return client
}
