package themuse

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestTheMuseSearchContinuesPastFormerDefaultPagesUntilEmpty(t *testing.T) {
	calls := 0
	adapter := NewTheMuse()
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++
		page, err := strconv.Atoi(req.URL.Query().Get("page"))
		if err != nil {
			t.Fatalf("invalid page query: %v", err)
		}
		if page > 4 {
			return testutil.Response(`{"results":[]}`), nil
		}
		return testutil.Response(fmt.Sprintf(`{
			"results":[{
				"name":"Dev Go %d",
				"company":{"name":"Acme"},
				"refs":{"landing_page":"https://example.com/themuse/%d"},
				"locations":[{"name":"Brasil"}],
				"publication_date":"2026-07-27T00:00:00Z"
			}]
		}`, page, page)), nil
	})

	jobs, err := adapter.Search(context.Background(), "go", domain.ScrapeRequest{
		WaitBetweenSearchesMs: 1,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 4 {
		t.Fatalf("expected 4 jobs from pages past old limit, got %d", len(jobs))
	}
	if calls != 5 {
		t.Fatalf("expected 5 calls including empty page, got %d", calls)
	}
}
