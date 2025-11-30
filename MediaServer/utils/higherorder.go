package serverutils

func Filter[T any](origin []T, predicate func(T) bool) []T {
	dst := []T{}
	for _, v := range origin {
		if predicate(v) {
			dst = append(dst, v)
		}
	}
	return dst
}

func ListContain[T comparable](inThisList []T, compare T) bool {
	for _, v := range inThisList {
		if v == compare {
			return true
		}
	}
	return false
}
