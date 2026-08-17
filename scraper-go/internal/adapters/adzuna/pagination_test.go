package adzuna

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestAdzunaSearchContinuesPastFormerDefaultPagesUntilEmpty(t *testing.T) {
	calls := 0
	adapter := NewAdzuna("app", "key", "br")
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++
		parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
		page, err := strconv.Atoi(parts[len(parts)-1])
		if err != nil {
			t.Fatalf("invalid page in path %q: %v", req.URL.Path, err)
		}
		if page > 4 {
			return testutil.Response(`{"results":[]}`), nil
		}
		return testutil.Response(fmt.Sprintf(`{
			"results":[{
				"title":"Dev Go %d",
				"company":{"display_name":"Acme"},
				"location":{"display_name":"Brasil"},
				"redirect_url":"https://example.com/adzuna/%d",
				"created":"2026-07-27T00:00:00Z"
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

func TestAdzunaSearchStopsOnRepeatedPage(t *testing.T) {
	calls := 0
	adapter := NewAdzuna("app", "key", "br")
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++
		return testutil.Response(`{
			"results":[{
				"title":"Dev Go",
				"company":{"display_name":"Acme"},
				"location":{"display_name":"Brasil"},
				"redirect_url":"https://example.com/adzuna/repeated",
				"created":"2026-07-27T00:00:00Z"
			}]
		}`), nil
	})

	jobs, err := adapter.Search(context.Background(), "go", domain.ScrapeRequest{
		WaitBetweenSearchesMs: 1,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected only first repeated page to be kept, got %d jobs", len(jobs))
	}
	if calls != 2 {
		t.Fatalf("expected stop after detecting repeated second page, got %d calls", calls)
	}
}

func TestAdzunaSearchKeepsPartialResultsOnTransientFailure(t *testing.T) {
	calls := 0
	adapter := NewAdzuna("app", "key", "br")
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++
		parts := strings.Split(strings.Trim(req.URL.Path, "/"), "/")
		page, err := strconv.Atoi(parts[len(parts)-1])
		if err != nil {
			t.Fatalf("invalid page in path %q: %v", req.URL.Path, err)
		}
		if page == 2 {
			return testutil.StatusResponse(http.StatusServiceUnavailable, `{"error":"busy"}`), nil
		}
		return testutil.Response(`{
			"results":[{
				"title":"Dev Java",
				"company":{"display_name":"Acme"},
				"location":{"display_name":"Brasil"},
				"redirect_url":"https://example.com/adzuna/java",
				"created":"2026-07-27T00:00:00Z"
			}]
		}`), nil
	})

	jobs, err := adapter.Search(context.Background(), "java", domain.ScrapeRequest{
		WaitBetweenSearchesMs: 1,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected partial first page to be kept, got %d jobs", len(jobs))
	}
	if calls != 4 {
		t.Fatalf("expected first page plus 3 retry attempts on page 2, got %d calls", calls)
	}
}

func TestAdzunaSearchReturnsErrorWhenFirstPageFails(t *testing.T) {
	adapter := NewAdzuna("app", "key", "br")
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		return testutil.StatusResponse(http.StatusServiceUnavailable, `{"error":"busy"}`), nil
	})

	jobs, err := adapter.Search(context.Background(), "java", domain.ScrapeRequest{
		WaitBetweenSearchesMs: 1,
	})

	if err == nil {
		t.Fatal("expected error when first page fails")
	}
	if len(jobs) != 0 {
		t.Fatalf("expected no jobs when first page fails, got %d", len(jobs))
	}
}
