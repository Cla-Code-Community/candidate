package lever

import (
	"context"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
)

func TestLeverCacheExpiresWhenExecutionChanges(t *testing.T) {
	a := NewLever("test", "test")
	calls := 0
	a.client = testHTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testResponse(`[]`), nil })
	for _, run := range []string{"first", "first", "next"} {
		_, err := a.fetchPostings(context.Background(), domain.ScrapeRequest{RunID: run})
		require.NoError(t, err)
	}
	require.Equal(t, 2, calls)
}
