package linkedin

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestLinkedInKeepsPartialBatchWhenCollectionIsCanceled(t *testing.T) {
	t.Setenv("LINKEDIN_KEYWORD_SLOT_SIZE", "2")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	adapter := NewLinkedIn()
	adapter.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
		cancel()
		return testutil.Response(`<div class="base-card"><h3>Backend Engineer</h3><h4>Acme</h4><a class="base-card__full-link" href="https://example.com/jobs/1"></a></div>`), nil
	})
	jobs, err := adapter.SearchBatch(ctx, []string{"go", "java"}, domain.ScrapeRequest{MaxPagesPerKeyword: 2, WaitBetweenSearchesMs: 1})
	require.True(t, errors.Is(err, context.Canceled))
	require.Len(t, jobs, 1)
}
