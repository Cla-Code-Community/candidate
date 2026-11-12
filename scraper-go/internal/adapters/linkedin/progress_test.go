package linkedin

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/prometheus/client_golang/prometheus"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func startObservedRun(t *testing.T, id string) {
	t.Helper()
	metrics.StartRun("manual", time.Now(), id)
	t.Cleanup(func() { metrics.FinishRun(nil, id) })
}
func TestLinkedInLiveProgressBeforeBatchReturns(t *testing.T) {
	const id = "linkedin-live"
	startObservedRun(t, id)
	t.Setenv("LINKEDIN_KEYWORD_SLOT_SIZE", "2")
	a := NewLinkedIn()
	entered, release, done := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("keywords") == "java" {
			close(entered)
			<-release
			return testutil.Response(""), nil
		}
		if r.URL.Query().Get("start") == "0" {
			return testutil.Response(coverageJobHTML), nil
		}
		return testutil.Response(""), nil
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
		t.Fatal("batch did not reach second keyword")
	}
	select {
	case <-done:
		t.Fatal("batch returned before progress check")
	default:
	}
	p := metrics.Current().LinkedIn
	require.NotNil(t, p)
	require.Equal(t, 2, p.Selected)
	require.Equal(t, 2, p.Started)
	require.Equal(t, 1, p.Completed)
	require.Equal(t, 3, p.Pages)
	require.Equal(t, 2, p.Requests)
	require.Equal(t, 1, p.Received)
	require.Equal(t, 1.0, promtest.ToFloat64(metrics.LinkedInProgress.WithLabelValues("keywords_completed")))
	releaseOnce.Do(func() { close(release) })
	<-done
	require.NoError(t, err)
	require.Len(t, jobs, 1)
	require.Equal(t, "Backend Engineer", jobs[0].Title)
	require.Equal(t, "https://example.com/jobs/1", jobs[0].URL)
	p = metrics.Current().LinkedIn
	require.Equal(t, 2, p.Completed)
	require.Equal(t, 3, p.Requests)
	require.Equal(t, 0, p.WithError)
	// Returned snapshots must not alias mutable state.
	p.Received = 999
	require.Equal(t, 1, metrics.Current().LinkedIn.Received)
}
func TestLinkedInProgressCountsHTTPFailuresWithoutChangingPartialResults(t *testing.T) {
	const id = "linkedin-http"
	startObservedRun(t, id)
	a := NewLinkedIn()
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testutil.Response(coverageJobHTML), nil
		}
		return testutil.StatusResponse(503, ""), nil
	})
	jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 2, WaitBetweenSearchesMs: 1})
	require.NoError(t, err, "legacy later-page failure remains non-terminal")
	require.Len(t, jobs, 1)
	p := metrics.Current().LinkedIn
	require.Equal(t, 2, p.Pages)
	require.Equal(t, 2, p.Requests)
	require.Equal(t, 1, p.HTTPErrors)
	require.Equal(t, 1, p.WithError)
	require.Equal(t, 1, p.Completed)
}
func TestLinkedInProgressRateLimitBackoffAndRetry(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const id = "linkedin-retry"
		startObservedRun(t, id)
		a := NewLinkedIn()
		calls := 0
		a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
			calls++
			if calls == 1 {
				return testutil.StatusResponse(429, ""), nil
			}
			return testutil.Response(coverageJobHTML), nil
		})
		before := time.Now()
		jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1})
		require.NoError(t, err)
		require.Len(t, jobs, 1)
		require.Equal(t, 15*time.Second, time.Since(before))
		p := metrics.Current().LinkedIn
		require.Equal(t, 1, p.Pages)
		require.Equal(t, 2, p.Requests)
		require.Equal(t, 1, p.RateLimits)
		require.Equal(t, 1, p.Backoffs)
		require.Equal(t, 1, p.Retries)
		require.Equal(t, 1, p.WithError)
	})
}
func TestLinkedInProgressTimeoutAndCancellation(t *testing.T) {
	for _, failure := range []error{context.Canceled, context.DeadlineExceeded} {
		t.Run(failure.Error(), func(t *testing.T) {
			id := "linkedin-" + failure.Error()
			startObservedRun(t, id)
			a := NewLinkedIn()
			a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { return nil, failure })
			jobs, err := a.SearchBatch(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1})
			require.ErrorIs(t, err, failure)
			require.Empty(t, jobs)
			p := metrics.Current().LinkedIn
			require.Equal(t, 1, p.WithError)
			require.Equal(t, 0, p.Completed)
			require.Equal(t, 1, p.Requests)
			if errors.Is(failure, context.DeadlineExceeded) {
				require.Equal(t, 1, p.Timeouts)
			}
		})
	}
}
func TestLinkedInProgressCancelDuringBackoff(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const id = "linkedin-cancel-backoff"
		startObservedRun(t, id)
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		a := NewLinkedIn()
		a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { return testutil.StatusResponse(429, ""), nil })
		go func() { time.Sleep(time.Second); cancel() }()
		_, err := a.SearchBatch(ctx, []string{"go"}, domain.ScrapeRequest{RunID: id, MaxPagesPerKeyword: 1})
		require.ErrorIs(t, err, context.Canceled)
		p := metrics.Current().LinkedIn
		require.Equal(t, 1, p.Backoffs)
		require.Zero(t, p.Retries)
		require.Equal(t, 1, p.WithError)
	})
}
func TestLinkedInProgressFullCoverageSelectionAndRunIsolation(t *testing.T) {
	const first = "linkedin-first"
	startObservedRun(t, first)
	a := NewLinkedIn()
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { return testutil.Response(""), nil })
	_, err := a.SearchBatch(context.Background(), []string{"go", "go", " ", " java "}, domain.ScrapeRequest{RunID: first, FullKeywordCoverage: true, MaxPagesPerKeyword: 1})
	require.NoError(t, err)
	require.Equal(t, 2, metrics.Current().LinkedIn.Selected)
	require.Equal(t, 2, metrics.Current().LinkedIn.Completed)
	old := metrics.BeginLinkedInProgress(first, 7)
	metrics.StartRun("manual", time.Now(), "linkedin-second")
	require.Nil(t, metrics.Current().LinkedIn)
	token := metrics.BeginLinkedInProgress("linkedin-second", 1)
	metrics.ObserveLinkedInProgress(first, old, metrics.LinkedInProgressEvent{Kind: "keyword_started"})
	metrics.ObserveLinkedInProgress("linkedin-second", token, metrics.LinkedInProgressEvent{Kind: "keyword_started", Keyword: "rust"})
	p := metrics.Current().LinkedIn
	require.Equal(t, "linkedin-second", p.RunID)
	require.Equal(t, 1, p.Started)
	require.Zero(t, p.Requests)
	newer := metrics.BeginLinkedInProgress("linkedin-second", 2)
	metrics.ObserveLinkedInProgress("linkedin-second", token, metrics.LinkedInProgressEvent{Kind: "keyword_started"})
	require.NotEqual(t, token, newer)
	require.Zero(t, metrics.Current().LinkedIn.Started)
	metrics.FinishRun(nil, "linkedin-second")
	// Prometheus labels stay bounded: neither keyword nor run ID is a label.
	families, err := prometheus.DefaultGatherer.Gather()
	require.NoError(t, err)
	for _, f := range families {
		if f.GetName() == "candidate_scraper_linkedin_progress" {
			for _, m := range f.Metric {
				for _, l := range m.Label {
					require.Equal(t, "kind", l.GetName())
				}
			}
		}
	}
}
