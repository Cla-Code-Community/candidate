package linkedin

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestLinkedInSearchContinuesPastFormerDefaultPagesUntilEmpty(t *testing.T) {
	calls := 0
	adapter := NewLinkedIn()
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++
		start, err := strconv.Atoi(req.URL.Query().Get("start"))
		if err != nil {
			t.Fatalf("invalid start query: %v", err)
		}
		page := start/linkedinPageStep + 1
		if page > 6 {
			return testutil.Response(""), nil
		}
		return testutil.Response(fmt.Sprintf(`
			<div class="base-card">
				<h3>Dev Go %d</h3>
				<h4>Acme</h4>
				<span class="job-search-card__location">Brasil</span>
				<a class="base-card__full-link" href="https://example.com/linkedin/%d"></a>
			</div>
		`, page, page)), nil
	})

	jobs, err := adapter.Search(context.Background(), "go", domain.ScrapeRequest{
		WaitBetweenSearchesMs: 1,
		MaxPagesPerKeyword:    10,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 6 {
		t.Fatalf("expected 6 jobs from pages past old limit, got %d", len(jobs))
	}
	if calls != 7 {
		t.Fatalf("expected 7 calls including empty page, got %d calls", calls)
	}
}
