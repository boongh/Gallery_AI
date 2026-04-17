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

func Map[A any, B any](origin []A, operator func(A) B) []B {
	dst := []B{}
	for _, v := range origin {
		dst = append(dst, operator(v))
	}

	return dst
}
