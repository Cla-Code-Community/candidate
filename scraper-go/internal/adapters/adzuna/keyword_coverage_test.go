package adzuna

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
)

const coverageJobJSON = `{"results":[{"title":"Backend Engineer","company":{"display_name":"Acme"},"redirect_url":"https://example.com/jobs/1"}]}`

func TestAdzunaFullCoveragePerWindowPreservesLegacyCursor(t *testing.T) {
	t.Setenv("ADZUNA_KEYWORD_SLOT_SIZE", "2")
	a := NewAdzuna("app", "key", "br")
	a.nextOffset = 5
	var keywords []string
	for i := 0; i < 37; i++ {
		keywords = append(keywords, fmt.Sprintf("query-%02d", i))
	}
	var seen []string
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, "app", r.URL.Query().Get("app_id"))
		require.Equal(t, "key", r.URL.Query().Get("app_key"))
		seen = append(seen, r.URL.Query().Get("what"))
		return testutil.Response(`{"results":[]}`), nil
	})
	for _, window := range []string{"adzuna-1", "adzuna-2"} {
		seen = nil
		_, err := a.SearchBatch(context.Background(), keywords, domain.ScrapeRequest{FullKeywordCoverage: true, WindowID: window, MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
		require.NoError(t, err)
		require.Equal(t, keywords, seen)
		require.Equal(t, 5, a.nextOffset)
	}
	seen = nil
	_, err := a.SearchBatch(context.Background(), keywords, domain.ScrapeRequest{MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
	require.NoError(t, err)
	require.Equal(t, keywords[5:7], seen)
	require.Equal(t, 7, a.nextOffset)
}

func TestAdzunaFullCoverageStopsAtRetryAfterAndKeepsCompletedResults(t *testing.T) {
	a := NewAdzuna("app", "key", "br")
	calls := 0
	retry := time.Now().UTC().Add(time.Hour).Truncate(time.Second)
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testutil.Response(coverageJobJSON), nil
		}
		resp := testutil.Response("")
		resp.StatusCode = 429
		resp.Header.Set("Retry-After", retry.Format(http.TimeFormat))
		return resp, nil
	})
	jobs, err := a.SearchBatch(context.Background(), []string{"go", "java", "rust"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
	var limit *ports.RateLimitError
	require.ErrorAs(t, err, &limit)
	require.Equal(t, retry, limit.NotBefore)
	require.Equal(t, 2, calls)
	require.Len(t, jobs, 1)
}

func TestAdzunaFullCoverageCancellationKeepsCurrentPage(t *testing.T) {
	a := NewAdzuna("app", "key", "br")
	calls := 0
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		cancel()
		return testutil.Response(coverageJobJSON), nil
	})
	jobs, err := a.SearchBatch(ctx, []string{"go", "java", "rust"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 3, WaitBetweenSearchesMs: 1})
	require.ErrorIs(t, err, context.Canceled)
	require.Len(t, jobs, 1)
	require.Equal(t, 1, calls)
}

func TestAdzunaFullCoverageReportsLaterPageFailure(t *testing.T) {
	a := NewAdzuna("app", "key", "br")
	calls := 0
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		resp := testutil.Response(coverageJobJSON)
		if calls == 2 {
			resp.StatusCode = 400
		}
		return resp, nil
	})
	jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 3, WaitBetweenSearchesMs: 1})
	require.Error(t, err)
	require.Len(t, jobs, 1)
	require.Equal(t, 2, calls)
}

func TestAdzunaFullCoverageDeadlineKeepsEarlierKeywords(t *testing.T) {
	a := NewAdzuna("app", "key", "br")
	calls := 0
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testutil.Response(coverageJobJSON), nil
		}
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	jobs, err := a.SearchBatch(ctx, []string{"go", "java", "rust"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Len(t, jobs, 1)
	require.Equal(t, 2, calls)
}
