package ports

import (
	"fmt"
	"time"
)

type RateLimitError struct {
	Provider  ProviderID
	NotBefore time.Time
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("%s: rate limit (429), retry after %s", e.Provider, e.NotBefore.UTC().Format(time.RFC3339))
}

// LatestRetryAfter also handles errors.Join from multiple failed collection tasks.
func LatestRetryAfter(err error, provider ProviderID) time.Time {
	if err == nil {
		return time.Time{}
	}
	var latest time.Time
	if limit, ok := err.(*RateLimitError); ok && limit.Provider == provider {
		latest = limit.NotBefore
	}
	var causes []error
	if group, ok := err.(interface{ Unwrap() []error }); ok {
		causes = group.Unwrap()
	} else if wrapped, ok := err.(interface{ Unwrap() error }); ok {
		causes = []error{wrapped.Unwrap()}
	}
	for _, cause := range causes {
		if next := LatestRetryAfter(cause, provider); next.After(latest) {
			latest = next
		}
	}
	return latest
}
