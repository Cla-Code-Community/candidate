package metrics

import (
	"context"
	"errors"
	"net"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

func counter(name string, labels ...string) *prometheus.CounterVec {
	return promauto.NewCounterVec(prometheus.CounterOpts{Name: name, Help: strings.ReplaceAll(name, "_", " ")}, labels)
}
func gauge(name string, labels ...string) *prometheus.GaugeVec {
	return promauto.NewGaugeVec(prometheus.GaugeOpts{Name: name, Help: strings.ReplaceAll(name, "_", " ")}, labels)
}
func histogram(name string, buckets []float64, labels ...string) *prometheus.HistogramVec {
	return promauto.NewHistogramVec(prometheus.HistogramOpts{Name: name, Help: strings.ReplaceAll(name, "_", " "), Buckets: buckets}, labels)
}

var durationBuckets = []float64{.001, .01, .05, .1, .5, 1, 5, 30, 120, 600, 1800, 3600}
var (
	Runs                      = counter("candidate_scraper_runs_total", "source", "status")
	RunDuration               = histogram("candidate_scraper_run_duration_seconds", durationBuckets, "source", "status")
	LastRun                   = gauge("candidate_scraper_last_run_timestamp_seconds", "source", "status")
	Progress                  = gauge("candidate_scraper_progress", "kind")
	LastProgress              = promauto.NewGauge(prometheus.GaugeOpts{Name: "candidate_scraper_last_progress_timestamp_seconds", Help: "Last real pipeline progress timestamp"})
	ProviderConfigured        = gauge("candidate_scraper_provider_configured_concurrency", "provider")
	ProviderActive            = gauge("candidate_scraper_provider_active_tasks", "provider")
	ProviderWaiting           = gauge("candidate_scraper_provider_waiting_tasks", "provider")
	ProviderRuns              = counter("candidate_scraper_provider_runs_total", "provider", "status")
	ProviderDuration          = histogram("candidate_scraper_provider_duration_seconds", durationBuckets, "provider", "status")
	ProviderErrors            = counter("candidate_scraper_provider_errors_total", "provider", "error_type")
	ProviderTimeouts          = counter("candidate_scraper_provider_timeouts_total", "provider")
	ProviderJobs              = counter("candidate_scraper_provider_jobs_total", "provider", "result")
	DiscoveryRuns             = counter("candidate_scraper_provider_discovery_runs_total", "provider", "mode")
	DiscoveryKeywords         = counter("candidate_scraper_provider_keywords_total", "provider", "mode")
	LockConflicts             = counter("candidate_scraper_lock_conflicts_total", "source")
	LockRenewFailures         = promauto.NewCounter(prometheus.CounterOpts{Name: "candidate_scraper_lock_renew_failures_total", Help: "Temporary renewal failures"})
	LockLost                  = counter("candidate_scraper_lock_lost_total", "source")
	ClassificationJobs        = counter("candidate_scraper_classification_jobs_total", "result", "family")
	ClassificationDuration    = histogram("candidate_scraper_classification_duration_seconds", durationBuckets, "result")
	ClassificationRejections  = counter("candidate_scraper_classification_rejections_total", "family", "reason_code")
	PersistenceDuration       = histogram("candidate_scraper_persistence_batch_duration_seconds", durationBuckets, "status")
	PersistenceBatches        = counter("candidate_scraper_persistence_batches_total", "status")
	PersistenceJobs           = counter("candidate_scraper_persistence_jobs_total", "result")
	PersistenceRetries        = counter("candidate_scraper_persistence_retries_total", "reason")
	PersistenceRollbacks      = counter("candidate_scraper_persistence_rollbacks_total", "reason")
	PersistenceFailures       = counter("candidate_scraper_persistence_failures_total", "reason")
	PersistenceBatchSize      = histogram("candidate_scraper_persistence_batch_size", []float64{1, 10, 50, 100, 200, 500, 1000, 2500})
	CacheInvalidationDuration = histogram("candidate_jobs_search_cache_operation_duration_seconds", durationBuckets, "operation")
	IndexDuration             = histogram("candidate_scraper_index_batch_duration_seconds", durationBuckets, "status")
	IndexBatches              = counter("candidate_scraper_index_batches_total", "status")
	IndexJobs                 = counter("candidate_scraper_index_jobs_total", "result")
	IndexFailures             = counter("candidate_scraper_index_failures_total", "reason")
	IndexBatchSize            = histogram("candidate_scraper_index_batch_size", []float64{1, 10, 50, 100, 200, 500, 1000, 2500})
	Divergences               = gauge("candidate_scraper_index_reconciliation_divergences", "kind")
	RebuildProgress           = promauto.NewGauge(prometheus.GaugeOpts{Name: "candidate_scraper_index_rebuild_jobs", Help: "Jobs projected by current or last rebuild"})
	// Defined in both owners with exactly the same schema. Aggregate by job in rules
	// when attribution is required; Go observes only committed projection changes.
)

func Source(source string) string {
	if source == "cron" {
		return "cron"
	}
	return "manual"
}
func Provider(value string) string {
	if p, ok := ports.ParseProviderID(strings.ReplaceAll(strings.Split(strings.ToLower(strings.TrimSpace(value)), ":")[0], " ", "")); ok {
		return string(p)
	}
	return "unknown"
}
func ErrorType(err error) string {
	if err == nil {
		return "none"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, context.Canceled) {
		return "canceled"
	}
	var e net.Error
	if errors.As(err, &e) {
		if e.Timeout() {
			return "timeout"
		}
		return "network"
	}
	// Legacy adapters expose status through wrapped strings. Only fixed categories
	// escape this boundary; the actual message is never a metric label.
	s := strings.ToLower(err.Error())
	if strings.Contains(s, "scraper run lock lost") {
		return "canceled"
	}
	switch {
	case strings.Contains(s, "429") || strings.Contains(s, "rate limit"):
		return "rate_limit"
	case strings.Contains(s, "401") || strings.Contains(s, "403"):
		return "authentication"
	case strings.Contains(s, "timeout") || strings.Contains(s, "deadline"):
		return "timeout"
	case strings.Contains(s, "decode") || strings.Contains(s, "unmarshal") || strings.Contains(s, "json"):
		return "parsing"
	case strings.Contains(s, "invalid") || strings.Contains(s, "validation"):
		return "validation"
	case strings.Contains(s, "connection") || strings.Contains(s, "network"):
		return "network"
	}
	return "unknown"
}
func Status(err error) string {
	if err == nil {
		return "success"
	}
	t := ErrorType(err)
	if t == "timeout" || t == "canceled" {
		return t
	}
	return "failed"
}
func BatchStatus(err error) string {
	s := Status(err)
	if s == "timeout" {
		return "canceled"
	}
	return s
}
func RecordProvider(provider, mode string, keywords, jobs int, started time.Time, err error) {
	p := Provider(provider)
	status := Status(err)
	ProviderRuns.WithLabelValues(p, status).Inc()
	ProviderDuration.WithLabelValues(p, status).Observe(time.Since(started).Seconds())
	DiscoveryRuns.WithLabelValues(p, mode).Inc()
	DiscoveryKeywords.WithLabelValues(p, mode).Add(float64(keywords))
	if err != nil {
		ProviderErrors.WithLabelValues(p, ErrorType(err)).Inc()
		if status == "timeout" {
			ProviderTimeouts.WithLabelValues(p).Inc()
		}
	}
	ProviderJobs.WithLabelValues(p, "collected").Add(float64(jobs))
	taskFinished(p, status, keywords)
}
func JobResult(provider, result string, n int) {
	if n > 0 {
		seen := map[string]bool{}
		for _, source := range strings.Split(provider, ",") {
			p := Provider(source)
			if !seen[p] {
				ProviderJobs.WithLabelValues(p, result).Add(float64(n))
				seen[p] = true
			}
		}
	}
}
func ObservePersistence(started time.Time, size, inserted, updated, skipped int, err error) {
	status := BatchStatus(err)
	PersistenceDuration.WithLabelValues(status).Observe(time.Since(started).Seconds())
	PersistenceBatches.WithLabelValues(status).Inc()
	PersistenceBatchSize.WithLabelValues().Observe(float64(size))
	if err != nil {
		RecordStateError(err)
		PersistenceJobs.WithLabelValues("failed").Add(float64(size))
		PersistenceFailures.WithLabelValues(PersistenceErrorReason(err)).Inc()
	} else {
		PersistenceJobs.WithLabelValues("inserted").Add(float64(inserted))
		PersistenceJobs.WithLabelValues("updated").Add(float64(updated))
		PersistenceJobs.WithLabelValues("skipped").Add(float64(max(0, skipped)))
	}
}
func ObserveIndex(started time.Time, size, changed int, err error) {
	status := BatchStatus(err)
	IndexDuration.WithLabelValues(status).Observe(time.Since(started).Seconds())
	IndexBatches.WithLabelValues(status).Inc()
	IndexBatchSize.WithLabelValues().Observe(float64(size))
	if err != nil {
		RecordStateError(err)
		IndexFailures.WithLabelValues(ErrorType(err)).Inc()
		IndexJobs.WithLabelValues("failed").Add(float64(size))
	} else {
		IndexJobs.WithLabelValues("updated").Add(float64(changed))
		IndexJobs.WithLabelValues("skipped").Add(float64(max(0, size-changed)))
	}
}

func PersistenceErrorReason(err error) string {
	var e *pq.Error
	if errors.As(err, &e) {
		if e.Code == "40001" || e.Code == "40P01" || e.Code == "23505" {
			return "conflict"
		}
		if strings.HasPrefix(string(e.Code), "08") {
			return "network"
		}
		return "permanent"
	}
	return ErrorType(err)
}
