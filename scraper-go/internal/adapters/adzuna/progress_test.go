package adzuna

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func startObservedRun(t *testing.T, id string) {
	t.Helper()
	metrics.StartRun("manual", time.Now(), id)
	t.Cleanup(func() { metrics.FinishRun(nil, id) })
}
func TestAdzunaLiveProgressBeforeBatchReturns(t *testing.T) {
	const id = "adzuna-live"
	startObservedRun(t, id)
	t.Setenv("ADZUNA_KEYWORD_SLOT_SIZE", "2")
	a := NewAdzuna("fixture-app", "fixture-key", "br")
	entered, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var once sync.Once
	t.Cleanup(func() { once.Do(func() { close(release) }) })
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("what") == "java" {
			close(entered)
			<-release
			return testutil.Response(`{"results":[]}`), nil
		}
		if strings.HasSuffix(r.URL.Path, "/1") {
			return testutil.Response(coverageJobJSON), nil
		}
		return testutil.Response(`{"results":[]}`), nil
	})
	var jobs []domain.Job
	var err error
	go func() {
		defer close(done)
		jobs, err = a.SearchBatch(context.Background(), []string{"go", "java"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 2, WaitBetweenSearchesMs: 1})
	}()
	select {
	case <-entered:
	case <-time.After(time.Second):
		t.Fatal("second keyword did not start")
	}
	select {
	case <-done:
		t.Fatal("batch already returned")
	default:
	}
	p := metrics.Current().Adzuna
	require.NotNil(t, p)
	require.Equal(t, 2, p.Selected)
	require.Equal(t, 2, p.Started)
	require.Equal(t, 1, p.Completed)
	require.Equal(t, 3, p.Pages)
	require.Equal(t, 2, p.Requests)
	require.Equal(t, 1, p.Received)
	require.Equal(t, 1.0, promtest.ToFloat64(metrics.AdzunaProgress.WithLabelValues("keywords_completed")))
	once.Do(func() { close(release) })
	<-done
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	require.Equal(t, "Backend Engineer", jobs[0].Title)
	require.Equal(t, "https://example.com/jobs/1", jobs[0].URL)
	p = metrics.Current().Adzuna
	require.Equal(t, 2, p.Completed)
	require.Equal(t, 3, p.Requests)
	require.Zero(t, p.WithError)
	p.Received = 999
	require.Equal(t, 1, metrics.Current().Adzuna.Received)
}
func TestAdzunaProgressManualMixedResultsRemainUnchanged(t *testing.T) {
	const id = "adzuna-mixed"
	startObservedRun(t, id)
	a := NewAdzuna("app", "key", "br")
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("what") == "go" {
			return testutil.Response(coverageJobJSON), nil
		}
		return testutil.StatusResponse(400, ""), nil
	})
	jobs, err := a.SearchBatch(context.Background(), []string{"go", "java"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1, WaitBetweenSearchesMs: 1})
	require.NoError(t, err, "existing manual success behavior is preserved")
	require.Len(t, jobs, 1)
	p := metrics.Current().Adzuna
	require.Equal(t, 2, p.Finished)
	require.Equal(t, 1, p.Completed)
	require.Equal(t, 1, p.WithError)
	require.Equal(t, 1, p.HTTPErrors)
	require.Equal(t, 2, p.Pages)
	require.Equal(t, 1, p.Received)
}
func TestAdzunaProgressRetryAndBackoff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const id = "adzuna-retry"
		startObservedRun(t, id)
		a := NewAdzuna("app", "key", "br")
		calls := 0
		a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
			calls++
			if calls == 1 {
				return testutil.StatusResponse(503, ""), nil
			}
			return testutil.Response(`{"results":[]}`), nil
		})
		start := time.Now()
		jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1})
		require.NoError(t, err)
		require.Empty(t, jobs)
		require.Equal(t, 1500*time.Millisecond, time.Since(start))
		p := metrics.Current().Adzuna
		require.Equal(t, 1, p.Pages)
		require.Equal(t, 2, p.Requests)
		require.Equal(t, 1, p.HTTPErrors)
		require.Equal(t, 1, p.Retries)
		require.Equal(t, 1, p.Backoffs)
		require.Equal(t, 1, p.WithError)
		require.Equal(t, 1, p.Completed)
	})
}
func TestAdzunaProgressRateLimitModes(t *testing.T) {
	for _, full := range []bool{false, true} {
		t.Run(fmt.Sprint(full), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				id := fmt.Sprintf("adzuna-rate-%t", full)
				startObservedRun(t, id)
				a := NewAdzuna("app", "key", "br")
				a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
					r := testutil.StatusResponse(429, "")
					r.Header.Set("Retry-After", "120")
					return r, nil
				})
				before := time.Now()
				jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, FullKeywordCoverage: full, MaxPagesPerKeyword: 1})
				require.Empty(t, jobs)
				var limit *ports.RateLimitError
				require.ErrorAs(t, err, &limit)
				p := metrics.Current().Adzuna
				require.Equal(t, 1, p.WithError)
				require.Zero(t, p.Completed)
				if full {
					require.Equal(t, 1, p.Requests)
					require.Equal(t, 1, p.RateLimits)
					require.Zero(t, p.Retries)
					require.Zero(t, p.Backoffs)
					require.Equal(t, time.Duration(0), time.Since(before))
				} else {
					require.Equal(t, 3, p.Requests)
					require.Equal(t, 3, p.RateLimits)
					require.Equal(t, 2, p.Retries)
					require.Equal(t, 3, p.Backoffs)
					require.Equal(t, 9*time.Second, time.Since(before))
				}
			})
		})
	}
}
func TestAdzunaProgressTimeoutAndCancellation(t *testing.T) {
	for _, deadline := range []bool{false, true} {
		t.Run(fmt.Sprint(deadline), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				id := fmt.Sprintf("adzuna-cancel-%t", deadline)
				startObservedRun(t, id)
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				a := NewAdzuna("app", "key", "br")
				a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
					if !deadline {
						cancel()
					}
					<-r.Context().Done()
					return nil, r.Context().Err()
				})
				jobs, err := a.SearchBatch(ctx, []string{"go"}, domain.ScrapeRequest{RunID: id, FullKeywordCoverage: true, MaxPagesPerKeyword: 1, PageTimeoutMs: 100})
				require.Empty(t, jobs)
				p := metrics.Current().Adzuna
				require.Equal(t, 1, p.WithError)
				require.Zero(t, p.Completed)
				if deadline {
					require.ErrorIs(t, err, context.DeadlineExceeded)
					require.Equal(t, 1, p.Timeouts)
					require.Equal(t, 1, p.Requests)
				} else {
					require.ErrorIs(t, err, context.Canceled)
					require.Equal(t, 1, p.Requests)
				}
			})
		})
	}
}
func TestAdzunaProgressRunAndBatchIsolation(t *testing.T) {
	const first = "adzuna-first"
	startObservedRun(t, first)
	a := NewAdzuna("app", "key", "br")
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { return testutil.Response(`{"results":[]}`), nil })
	_, err := a.SearchBatch(context.Background(), []string{"go", "go", " ", " java "}, domain.ScrapeRequest{RunID: first, FullKeywordCoverage: true, MaxPagesPerKeyword: 1})
	require.NoError(t, err)
	require.Equal(t, 2, metrics.Current().Adzuna.Selected)
	require.Equal(t, 2, metrics.Current().Adzuna.Completed)
	old := metrics.BeginAdzunaProgress(first, 10)
	metrics.StartRun("manual", time.Now(), "adzuna-second")
	require.Nil(t, metrics.Current().Adzuna)
	token := metrics.BeginAdzunaProgress("adzuna-second", 1)
	metrics.ObserveAdzunaProgress(first, old, metrics.AdzunaProgressEvent{Kind: "keyword_started"})
	require.Zero(t, metrics.Current().Adzuna.Started)
	metrics.ObserveAdzunaProgress("adzuna-second", token, metrics.AdzunaProgressEvent{Kind: "keyword_started", Keyword: "rust"})
	require.Equal(t, 1, metrics.Current().Adzuna.Started)
	require.Zero(t, metrics.Current().Adzuna.Requests)
	metrics.BeginAdzunaProgress("adzuna-second", 2)
	metrics.ObserveAdzunaProgress("adzuna-second", token, metrics.AdzunaProgressEvent{Kind: "keyword_started"})
	require.Zero(t, metrics.Current().Adzuna.Started)
	metrics.FinishRun(nil, "adzuna-second")
}
func TestAdzunaProgressLogsRedactCredentials(t *testing.T) {
	const id = "adzuna-redaction"
	startObservedRun(t, id)
	var out bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&out, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })
	a := NewAdzuna("private-app-id", "private-app-key", "br")
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		return nil, errors.New("transport failure " + r.URL.String())
	})
	_, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1})
	require.Error(t, err)
	logs := out.String()
	require.NotContains(t, logs, "private-app-id")
	require.NotContains(t, logs, "private-app-key")
	require.Contains(t, logs, "[redacted]")
	for _, event := range []string{"keyword_started", "page_started", "http_finished", "page_finished", "keyword_finished"} {
		require.Contains(t, logs, event)
	}
	require.Contains(t, logs, `"run_id":"adzuna-redaction"`)
}
