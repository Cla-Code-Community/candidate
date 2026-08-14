package jooble

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestJoobleSearchUsesRestPayloadAndPagination(t *testing.T) {
	calls := 0
	adapter := NewJooble("test-key", nil)
	adapter.client = testutil.HTTPClient(func(req *http.Request) (*http.Response, error) {
		calls++

		if req.Method != http.MethodPost {
			t.Fatalf("expected POST request, got %s", req.Method)
		}
		if req.URL.Host != "br.jooble.org" || req.URL.Path != "/api/test-key" {
			t.Fatalf("unexpected Jooble endpoint: %s", req.URL.String())
		}

		var payload map[string]any
		if err := json.NewDecoder(req.Body).Decode(&payload); err != nil {
			t.Fatalf("invalid request payload: %v", err)
		}

		page, ok := payload["page"].(string)
		if !ok {
			t.Fatalf("expected page as string, got %#v", payload["page"])
		}
		if payload["keywords"] != "go developer" {
			t.Fatalf("unexpected keywords payload: %#v", payload["keywords"])
		}
		if payload["location"] != "Brasil" {
			t.Fatalf("unexpected location payload: %#v", payload["location"])
		}
		if payload["ResultOnPage"] != float64(2) {
			t.Fatalf("unexpected ResultOnPage payload: %#v", payload["ResultOnPage"])
		}

		if page == "1" {
			return testutil.Response(`{
				"totalCount":3,
				"jobs":[
					{
						"title":"Go Developer",
						"company":"Acme",
						"location":"Brasil",
						"snippet":"Backend with Go",
						"type":"Full-time",
						"link":"https://example.com/jooble/123",
						"salary":"100",
						"updated":"2026-07-29T00:00:00Z",
						"id":123
					},
					{
						"title":"Platform Engineer",
						"company":"Beta",
						"location":"Remote",
						"snippet":"Golang platform",
						"link":"https://example.com/jooble/456",
						"id":456
					}
				]
			}`), nil
		}

		return testutil.Response(`{
			"totalCount":3,
			"jobs":[
				{
					"title":"Software Engineer",
					"company":"Gamma",
					"location":"Remote",
					"snippet":"Go services",
					"link":"https://example.com/jooble/789",
					"id":789
				}
			]
		}`), nil
	})

	jobs, err := adapter.Search(context.Background(), "go developer", domain.ScrapeRequest{
		MaxPagesPerKeyword: 2,
		ResultsPerPage:     2,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 3 {
		t.Fatalf("expected 3 jobs across pages, got %d", len(jobs))
	}
	if calls != 2 {
		t.Fatalf("expected 2 paginated calls, got %d", calls)
	}
	if jobs[0].ID != "123" {
		t.Fatalf("expected id from Jooble payload, got %q", jobs[0].ID)
	}
	if jobs[0].Description != "Backend with Go" {
		t.Fatalf("expected snippet as description, got %q", jobs[0].Description)
	}
}
