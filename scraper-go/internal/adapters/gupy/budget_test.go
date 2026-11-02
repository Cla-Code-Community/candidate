package gupy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
)

type fakeCursor struct {
	offset   int
	manifest string
}

func (c *fakeCursor) Load(_ context.Context, hash string, _ int) (int, error) {
	if c.manifest != "" && c.manifest != hash {
		return 0, fmt.Errorf("changed manifest")
	}
	return c.offset, nil
}
func (c *fakeCursor) Advance(_ context.Context, hash string, count, index int) error {
	if index != c.offset {
		return fmt.Errorf("cursor conflict")
	}
	c.manifest = hash
	c.offset = (index + 1) % count
	return nil
}
func automaticGupy(t *testing.T) (*GupyAdapter, domain.ScrapeRequest) {
	t.Helper()
	t.Setenv("GUPY_RAW_DISCOVERY_ENABLED", "false")
	t.Setenv("GUPY_FULL_SWEEP_ENABLED", "false")
	return NewGupy(), domain.ScrapeRequest{GupyWindow: true, QueryCursor: &fakeCursor{}, WindowID: "gupy-1"}
}
func rawGupyPage(count, offset int) string {
	data := make([]gupyJob, 0, count)
	for i := 0; i < count; i++ {
		id := offset + i
		data = append(data, gupyJob{ID: id + 1, Name: "Software Engineer", CareerPageName: "Acme", JobURL: fmt.Sprintf("https://example.com/jobs/%d", id), Description: "Build Go APIs"})
	}
	raw, _ := json.Marshal(gupyResponse{Data: data})
	return string(raw)
}

func TestGupyAutomaticSelects120AndRestartsAtPersistentPosition(t *testing.T) {
	a, req := automaticGupy(t)
	var keywords []string
	for i := 0; i < 200; i++ {
		keywords = append(keywords, fmt.Sprintf("query-%03d", i))
	}
	var seen []string
	client := testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		seen = append(seen, r.URL.Query().Get("jobName"))
		return testutil.Response(`{"data":[]}`), nil
	})
	a.client = client
	_, err := a.SearchBatch(context.Background(), keywords, req)
	require.NoError(t, err)
	require.Len(t, seen, 120)
	require.Equal(t, 120, req.QueryCursor.(*fakeCursor).offset)
	a = NewGupy()
	a.client = client
	seen = nil
	req.WindowID = "gupy-2"
	_, err = a.SearchBatch(context.Background(), keywords, req)
	require.NoError(t, err)
	require.Equal(t, "query-120", seen[0])
	require.Len(t, seen, 120)
}

func TestGupyHTTPBudgetDoesNotAdvanceUnstartedQueries(t *testing.T) {
	a, req := automaticGupy(t)
	t.Setenv("GUPY_AUTO_MAX_HTTP_ATTEMPTS", "2")
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testutil.Response(`{"data":[]}`), nil })
	_, err := a.SearchBatch(context.Background(), []string{"a", "b", "c", "d"}, req)
	require.ErrorIs(t, err, errHTTPBudget)
	require.Equal(t, 2, calls)
	require.Equal(t, 2, req.QueryCursor.(*fakeCursor).offset)
}

func TestGupyPageBudgetReturnsPartialAndRepeatedPageEndsNaturally(t *testing.T) {
	for _, repeated := range []bool{false, true} {
		t.Run(fmt.Sprint(repeated), func(t *testing.T) {
			a, req := automaticGupy(t)
			calls := 0
			a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
				offset := calls * 100
				if repeated {
					offset = 0
				}
				calls++
				return testutil.Response(rawGupyPage(100, offset)), nil
			})
			jobs, err := a.SearchBatch(context.Background(), []string{"unique-query"}, req)
			if repeated {
				require.NoError(t, err)
				require.Equal(t, 2, calls)
				require.Len(t, jobs, 100)
			} else {
				require.ErrorIs(t, err, errPageBudget)
				require.Equal(t, 5, calls)
				require.Len(t, jobs, 500)
			}
		})
	}
}

func TestGupy429AndCancellationKeepEarlierJobs(t *testing.T) {
	for _, cancelled := range []bool{false, true} {
		t.Run(fmt.Sprint(cancelled), func(t *testing.T) {
			a, req := automaticGupy(t)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			calls := 0
			retry := time.Now().Add(time.Hour).UTC().Truncate(time.Second)
			a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					return testutil.Response(rawGupyPage(1, 0)), nil
				}
				if cancelled {
					cancel()
					return nil, ctx.Err()
				}
				r := testutil.StatusResponse(429, "")
				r.Header.Set("Retry-After", retry.Format(http.TimeFormat))
				return r, nil
			})
			jobs, err := a.SearchBatch(ctx, []string{"a", "b", "c"}, req)
			require.Len(t, jobs, 1)
			require.Equal(t, 2, calls)
			if cancelled {
				require.ErrorIs(t, err, context.Canceled)
			} else {
				var limit *ports.RateLimitError
				require.ErrorAs(t, err, &limit)
				require.Equal(t, retry, limit.NotBefore)
			}
		})
	}
}

func TestGupyRetriesConsumeAttemptBudget(t *testing.T) {
	a, req := automaticGupy(t)
	t.Setenv("GUPY_AUTO_MAX_HTTP_ATTEMPTS", "2")
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testutil.StatusResponse(500, ""), nil })
	_, err := a.SearchBatch(context.Background(), []string{"a", "b", "c"}, req)
	require.ErrorIs(t, err, errHTTPBudget)
	require.Equal(t, 2, calls)
	require.Equal(t, 1, req.QueryCursor.(*fakeCursor).offset)
}

func TestGupyLegacyKeeps60QuerySelection(t *testing.T) {
	a, _ := automaticGupy(t)
	t.Setenv("GUPY_QUERY_LIMIT", "60")
	var kw []string
	for i := 0; i < 150; i++ {
		kw = append(kw, fmt.Sprintf("query-%03d", i))
	}
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testutil.Response(`{"data":[]}`), nil })
	_, err := a.SearchBatch(context.Background(), kw, domain.ScrapeRequest{})
	require.NoError(t, err)
	require.Equal(t, 60, calls)
}
