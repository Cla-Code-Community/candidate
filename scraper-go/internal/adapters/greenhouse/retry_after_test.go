package greenhouse

import (
	"context"
	"errors"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
	"time"
)

func TestGreenhouseRetryAfterAndCacheAreScopedToExecution(t *testing.T) {
	a := NewGreenhouse("test", "test")
	calls := 0
	a.client = testHTTPClient(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return &http.Response{StatusCode: 429, Header: http.Header{"Retry-After": []string{"120"}}, Body: http.NoBody}, nil
		}
		return testResponse(`{"jobs":[]}`), nil
	})
	start := time.Now()
	_, err := a.fetchJobs(context.Background(), domain.ScrapeRequest{RunID: "first"})
	var limit *ports.RateLimitError
	require.True(t, errors.As(err, &limit))
	require.False(t, limit.NotBefore.Before(start.Add(120*time.Second)))
	_, err = a.fetchJobs(context.Background(), domain.ScrapeRequest{RunID: "first"})
	require.Error(t, err)
	require.Equal(t, 1, calls)
	_, err = a.fetchJobs(context.Background(), domain.ScrapeRequest{RunID: "next"})
	require.NoError(t, err)
	require.Equal(t, 2, calls)
	_, err = a.fetchJobs(context.Background(), domain.ScrapeRequest{RunID: "last"})
	require.NoError(t, err)
	require.Equal(t, 3, calls)
}
