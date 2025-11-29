package errorlogs

import (
	"context"
	"log"
)

type functWithErr[T any] func() (T, error)

func failOnError[T any](f func() (T, error), succ string, fail string, ctx context.Context) T {

	resultch := make(chan struct {
		v   T
		err error
	})

	go func() {
		v, err := f()
		resultch <- struct {
			v   T
			err error
		}{v, err}
	}()

	select {
	case <-ctx.Done():
		log.Fatalf("%s, %v", fail, ctx.Err())
		var zero T
		return zero
	case r := <-resultch:
		if r.err != nil {
			log.Fatalf("%s, %v", fail, r.err)
		}
		if succ != "" {
			log.Printf("%s", succ)
		}
		return r.v
	}
}
