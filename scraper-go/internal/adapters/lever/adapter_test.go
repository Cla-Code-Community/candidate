package lever

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestLeverSearchMatchesRichPostingFields(t *testing.T) {
	t.Setenv("LEVER_INCLUDE_ALL_JOBS", "false")

	adapter := NewLever("acme", "Acme")
	adapter.client = testHTTPClient(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://api.lever.co/v0/postings/acme?mode=json" {
			t.Fatalf("unexpected endpoint: %s", req.URL.String())
		}
		return testResponse(`[
			{
				"id": "123",
				"text": "Backend Engineer",
				"hostedUrl": "https://jobs.lever.co/acme/123",
				"createdAt": 1785110400000,
				"country": "BR",
				"categories": {
					"team": "Platform",
					"department": "Engineering",
					"location": "Remote - Brazil",
					"commitment": "Full-time",
					"level": "Senior",
					"allLocations": ["Brazil", "Remote"]
				},
				"descriptionPlain": "Build payment services with Java.",
				"lists": [{"text": "Stack", "content": "<li>Kafka</li><li>PostgreSQL</li>"}],
				"additionalPlain": "Distributed systems.",
				"salaryRange": {"min": 100000, "max": 140000, "currency": "USD", "interval": "per-year-salary"},
				"workplaceType": "remote"
			},
			{
				"id": "456",
				"text": "Finance Analyst",
				"hostedUrl": "https://jobs.lever.co/acme/456",
				"categories": {"location": "New York", "commitment": "Full-time"},
				"descriptionPlain": "Budget planning.",
				"workplaceType": "onsite"
			}
		]`), nil
	})

	jobs, err := adapter.Search(context.Background(), "kafka", domain.ScrapeRequest{
		SearchLocation: "Brazil",
		RemoteOnly:     true,
	})

	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected one rich field match, got %d", len(jobs))
	}

	job := jobs[0]
	if job.ID != "https://jobs.lever.co/acme/123" {
		t.Fatalf("unexpected ID: %q", job.ID)
	}
	if job.Location != "Remote - Brazil | Brazil | Remote | BR" {
		t.Fatalf("unexpected location: %q", job.Location)
	}
	if job.Modality != "Remoto" {
		t.Fatalf("expected remote modality, got %q", job.Modality)
	}
	if !strings.Contains(job.Description, "Stack: Kafka PostgreSQL") {
		t.Fatalf("expected list content in description: %q", job.Description)
	}
	if job.Salary != "100000 - 140000 USD per-year-salary" {
		t.Fatalf("unexpected salary: %q", job.Salary)
	}
}

func TestLeverSearchBatchCachesPostingsAcrossKeywords(t *testing.T) {
	t.Setenv("LEVER_INCLUDE_ALL_JOBS", "false")

	var (
		mu    sync.Mutex
		calls int
	)

	adapter := NewLever("acme", "Acme")
	adapter.client = testHTTPClient(func(req *http.Request) (*http.Response, error) {
		mu.Lock()
		calls++
		mu.Unlock()

		return testResponse(`[
			{
				"id": "123",
				"text": "Go Engineer",
				"hostedUrl": "https://jobs.lever.co/acme/123",
				"categories": {"location": "Remote"},
				"descriptionPlain": "Backend APIs",
				"workplaceType": "remote"
			}
		]`), nil
	})

	jobs, err := adapter.SearchBatch(context.Background(), []string{"go", "backend", "engineer"}, domain.ScrapeRequest{})
	if err != nil {
		t.Fatalf("SearchBatch returned error: %v", err)
	}
	if len(jobs) != 1 {
		t.Fatalf("expected one job with merged keywords, got %d", len(jobs))
	}
	if strings.Join(jobs[0].Keywords, ",") != "go,backend,engineer" {
		t.Fatalf("unexpected keywords: %#v", jobs[0].Keywords)
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("expected one Lever postings call, got %d", calls)
	}
}

func TestLeverSearchBatchIncludesAllBoardJobsByDefault(t *testing.T) {
	adapter := NewLever("acme", "Acme")
	adapter.client = testHTTPClient(func(req *http.Request) (*http.Response, error) {
		return testResponse(`[
			{
				"id": "123",
				"text": "Go Engineer",
				"hostedUrl": "https://jobs.lever.co/acme/123",
				"categories": {"location": "Remote"},
				"descriptionPlain": "Backend APIs",
				"workplaceType": "remote"
			},
			{
				"id": "456",
				"text": "Customer Success Manager",
				"hostedUrl": "https://jobs.lever.co/acme/456",
				"categories": {"location": "Remote"},
				"descriptionPlain": "Enterprise customer onboarding.",
				"workplaceType": "remote"
			}
		]`), nil
	})

	jobs, err := adapter.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{})
	if err != nil {
		t.Fatalf("SearchBatch returned error: %v", err)
	}
	if len(jobs) != 2 {
		t.Fatalf("expected all board jobs by default, got %d", len(jobs))
	}
	if len(jobs[0].Keywords) != 1 || jobs[0].Keywords[0] != "go" {
		t.Fatalf("expected keyword match on first job, got %#v", jobs[0].Keywords)
	}
	if len(jobs[1].Keywords) != 0 || jobs[1].Keyword != "" {
		t.Fatalf("expected unmatched job without keyword metadata, got %q %#v", jobs[1].Keyword, jobs[1].Keywords)
	}
}

func TestLeverUsesExplicitAPIEndpoint(t *testing.T) {
	adapter := NewLeverWithEndpoint(
		"acme",
		"Acme",
		"future-region",
		"https://api.future.lever.co/v0/postings/acme?mode=json",
	)
	adapter.client = testHTTPClient(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://api.future.lever.co/v0/postings/acme?mode=json" {
			t.Fatalf("unexpected endpoint: %s", req.URL.String())
		}

		return testResponse(`[]`), nil
	})

	_, err := adapter.Search(context.Background(), "engineer", domain.ScrapeRequest{})
	if err != nil {
		t.Fatalf("Search returned error: %v", err)
	}
}
