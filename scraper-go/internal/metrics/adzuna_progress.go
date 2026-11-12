package metrics

import "time"

// These gauges describe the active run, not process-lifetime counters. Run IDs
// and keywords are available in the snapshot/logs, never in metric labels.
var AdzunaProgress = gauge("candidate_scraper_adzuna_progress", "kind")

// Reuse the operational schema and event vocabulary already used by LinkedIn.
// The state, generation fence and metric family remain provider-specific.
type AdzunaCollectionProgress = LinkedInCollectionProgress
type AdzunaProgressEvent = LinkedInProgressEvent

// A generation also fences delayed events from a previous batch in the same run.
func BeginAdzunaProgress(runID string, selected int) uint64 {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) {
		return 0
	}
	state.adzunaGeneration++
	state.adzuna = &AdzunaCollectionProgress{RunID: runID, Selected: selected, LastActivity: time.Now().UTC()}
	AdzunaProgress.Reset()
	publishAdzunaProgress()
	return state.adzunaGeneration
}
func ObserveAdzunaProgress(runID string, generation uint64, e AdzunaProgressEvent) {
	state.Lock()
	defer state.Unlock()
	if generation == 0 || generation != state.adzunaGeneration || !activeRun(runID) || state.adzuna == nil {
		return
	}
	p := state.adzuna
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
	publishAdzunaProgress()
	LastProgress.Set(float64(p.LastActivity.Unix()))
}

// Caller holds state.Mutex; Current returns a value copy of this snapshot.
func publishAdzunaProgress() {
	p := state.adzuna
	for kind, n := range map[string]int{"keywords_selected": p.Selected, "keywords_started": p.Started, "keywords_completed": p.Completed, "keywords_finished": p.Finished, "keywords_with_error": p.WithError, "pages_consulted": p.Pages, "requests_completed": p.Requests, "jobs_received": p.Received, "http_errors": p.HTTPErrors, "rate_limits": p.RateLimits, "timeouts": p.Timeouts, "retries": p.Retries, "backoffs": p.Backoffs} {
		AdzunaProgress.WithLabelValues(kind).Set(float64(n))
	}
	AdzunaProgress.WithLabelValues("last_activity_timestamp_seconds").Set(float64(p.LastActivity.Unix()))
}
