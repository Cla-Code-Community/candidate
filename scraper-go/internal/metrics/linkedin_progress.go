package metrics

import "time"

// These gauges describe the active run, not process-lifetime counters. Run IDs
// and keywords are available in the snapshot/logs, never in metric labels.
var LinkedInProgress = gauge("candidate_scraper_linkedin_progress", "kind")

type LinkedInCollectionProgress struct {
	RunID        string    `json:"runId"`
	Selected     int       `json:"keywordsSelected"`
	Started      int       `json:"keywordsStarted"`
	Completed    int       `json:"keywordsCompleted"`
	Finished     int       `json:"keywordsFinished"`
	WithError    int       `json:"keywordsWithError"`
	Pages        int       `json:"pagesConsulted"`
	Requests     int       `json:"requestsCompleted"`
	Received     int       `json:"jobsReceived"`
	HTTPErrors   int       `json:"httpErrors"`
	RateLimits   int       `json:"rateLimits"`
	Timeouts     int       `json:"timeouts"`
	Retries      int       `json:"retries"`
	Backoffs     int       `json:"backoffs"`
	Keyword      string    `json:"currentKeyword"`
	Page         int       `json:"page"`
	Offset       int       `json:"offset"`
	LastActivity time.Time `json:"lastActivity"`
}

type LinkedInProgressEvent struct {
	Kind, Keyword                      string
	Page, Offset, Received, HTTPStatus int
	Failed, HadError, Timeout          bool
}

// A generation also fences delayed events from a previous batch in the same run.
func BeginLinkedInProgress(runID string, selected int) uint64 {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) {
		return 0
	}
	state.linkedinGeneration++
	state.linkedin = &LinkedInCollectionProgress{RunID: runID, Selected: selected, LastActivity: time.Now().UTC()}
	LinkedInProgress.Reset()
	publishLinkedInProgress()
	return state.linkedinGeneration
}
func ObserveLinkedInProgress(runID string, generation uint64, e LinkedInProgressEvent) {
	state.Lock()
	defer state.Unlock()
	if generation == 0 || generation != state.linkedinGeneration || !activeRun(runID) || state.linkedin == nil {
		return
	}
	p := state.linkedin
	switch e.Kind {
	case "keyword_started":
		p.Started++
		p.Keyword = e.Keyword
		p.Page = 0
		p.Offset = 0
	case "keyword_finished":
		p.Finished++
		if !e.Failed {
			p.Completed++
		}
		if e.HadError || e.Failed {
			p.WithError++
		}
	case "page_started":
		p.Pages++
		p.Page = e.Page
		p.Offset = e.Offset
	case "http_finished":
		p.Requests++
		p.Received += e.Received
		if e.HTTPStatus >= 400 {
			p.HTTPErrors++
		}
		if e.HTTPStatus == 429 {
			p.RateLimits++
		}
		if e.Timeout {
			p.Timeouts++
		}
	case "retry":
		p.Retries++
	case "backoff":
		p.Backoffs++
	}
	p.LastActivity = time.Now().UTC()
	publishLinkedInProgress()
	LastProgress.Set(float64(p.LastActivity.Unix()))
}

// Caller holds state.Mutex; Current returns a value copy of this snapshot.
func publishLinkedInProgress() {
	p := state.linkedin
	for kind, n := range map[string]int{"keywords_selected": p.Selected, "keywords_started": p.Started, "keywords_completed": p.Completed, "keywords_finished": p.Finished, "keywords_with_error": p.WithError, "pages_consulted": p.Pages, "requests_completed": p.Requests, "jobs_received": p.Received, "http_errors": p.HTTPErrors, "rate_limits": p.RateLimits, "timeouts": p.Timeouts, "retries": p.Retries, "backoffs": p.Backoffs} {
		LinkedInProgress.WithLabelValues(kind).Set(float64(n))
	}
	LinkedInProgress.WithLabelValues("last_activity_timestamp_seconds").Set(float64(p.LastActivity.Unix()))
}
