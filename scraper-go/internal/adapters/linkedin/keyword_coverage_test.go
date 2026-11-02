package linkedin

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

const coverageJobHTML = `<div class="base-card"><h3>Backend Engineer</h3><h4>Acme</h4><a class="base-card__full-link" href="https://example.com/jobs/1"></a></div>`

func TestLinkedInFullCoveragePerWindowPreservesLegacyCursor(t *testing.T) {
	t.Setenv("LINKEDIN_KEYWORD_SLOT_SIZE", "2")
	a := NewLinkedIn()
	a.nextOffset = 5
	var keywords []string
	for i := 0; i < 37; i++ {
		keywords = append(keywords, fmt.Sprintf("query-%02d", i))
	}
	var seen []string
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		seen = append(seen, r.URL.Query().Get("keywords"))
		return testutil.Response(""), nil
	})
	for _, window := range []string{"linkedin-1", "linkedin-2", "linkedin-3"} {
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

func TestLinkedInFullCoverageStopsAtRateLimitAndKeepsCompletedResults(t *testing.T) {
	a := NewLinkedIn()
	calls := 0
	retry := time.Now().UTC().Add(time.Hour).Truncate(time.Second)
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testutil.Response(coverageJobHTML), nil
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

func TestLinkedInFullCoverageCancellationKeepsEarlierKeywords(t *testing.T) {
	a := NewLinkedIn()
	calls := 0
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testutil.Response(coverageJobHTML), nil
		}
		cancel()
		return nil, ctx.Err()
	})
	jobs, err := a.SearchBatch(ctx, []string{"go", "java", "rust"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
	require.ErrorIs(t, err, context.Canceled)
	require.Len(t, jobs, 1)
	require.Equal(t, 2, calls)
}

func TestLinkedInFullCoverageReportsLaterPageFailure(t *testing.T) {
	a := NewLinkedIn()
	calls := 0
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		calls++
		resp := testutil.Response(coverageJobHTML)
		if calls == 2 {
			resp.StatusCode = 500
		}
		return resp, nil
	})
	jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{FullKeywordCoverage: true, MaxPagesPerKeyword: 3, WaitBetweenSearchesMs: 1})
	require.Error(t, err)
	require.Len(t, jobs, 1)
	require.Equal(t, 2, calls)
}
