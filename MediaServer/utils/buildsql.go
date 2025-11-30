package serverutils

import (
	"strings"
)

func BuildSQL(allowednames []string, attributenames []string) string {
	dststr := Filter(attributenames, func(str string) bool {
		return ListContain(allowednames, str)
	})

	return strings.Join(dststr, ", ")
}
