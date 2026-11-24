package pipeline

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"regexp"
	"strconv"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
)

type AdapterTotals struct {
	Selected      int     `json:"selected"`
	Dispatched    int     `json:"dispatched"`
	Completed     int     `json:"completed"`
	Successes     int     `json:"successes"`
	Failures      int     `json:"failures"`
	Timeouts      int     `json:"timeouts"`
	Cancellations int     `json:"cancellations"`
	Undispatched  int     `json:"undispatched"`
	SuccessRate   float64 `json:"success_rate"`
}
type AdapterFailure struct {
	Provider   ports.ProviderID `json:"provider"`
	Adapter    string           `json:"adapter"`
	Category   string           `json:"category"`
	HTTPStatus int              `json:"http_status,omitempty"`
	Error      string           `json:"error"`
}
type adapterProgress struct{ expected, started, completed, failed, timeouts, canceled int }

func (s *providerRunStats) prepareAdapters(sources []ports.JobSource, keywords int) {
	for i, a := range sources {
		n := keywords
		if ports.CapabilitiesOf(a).Mode != ports.DiscoveryKeyword {
			n = 1
		}
		s.adapters[i] = &adapterProgress{expected: n}
	}
}
func (s *providerRunStats) started(t adapterTask) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if a := s.adapters[t.ordinal]; a != nil {
		a.started++
	}
	s.active++
	s.peak = max(s.peak, s.active)
}
func (s *providerRunStats) stopped() { s.mu.Lock(); defer s.mu.Unlock(); s.active-- }
func (s *providerRunStats) finish(stats *ProcessStats) {
	s.mu.Lock()
	defer s.mu.Unlock()
	a := AdapterTotals{Selected: len(s.adapters)}
	for _, p := range s.adapters {
		if p.started == 0 {
			a.Undispatched++
			continue
		}
		a.Dispatched++
		if p.completed == p.expected {
			a.Completed++
		}
		stats.TaskTimeouts += p.timeouts
		stats.TaskCancellations += p.canceled
		switch {
		case p.canceled > 0:
			a.Cancellations++
		case p.timeouts > 0:
			a.Timeouts++
		case p.failed > 0:
			a.Failures++
		case p.completed == p.expected:
			a.Successes++
		default:
			a.Cancellations++
		}
	}
	if a.Selected > 0 {
		a.SuccessRate = 100 * float64(a.Successes) / float64(a.Selected)
	}
	stats.Adapters = a
	stats.Failures = append([]AdapterFailure(nil), s.failures...)
	stats.EffectiveConcurrency = s.peak
}

// Adapter-local timeouts are collection failures. Only the enclosing run's
// deadline ends the cycle; cancellations and infrastructure errors remain fatal.
func EvaluateOutcome(stats ProcessStats, threshold int, critical error) (string, error) {
	if threshold == 0 {
		threshold = 50
	}
	if threshold < 1 || threshold > 100 {
		return "failed", fmt.Errorf("minimum success percent must be in 1..100")
	}
	if critical != nil {
		return "failed", critical
	}
	if stats.Failed > 0 {
		return "failed", fmt.Errorf("pipeline: %d persistence/indexing failures", stats.Failed)
	}
	if stats.DeadlineReached {
		return "failed", context.DeadlineExceeded
	}
	if stats.Adapters.Cancellations > 0 || errors.Is(stats.CollectionError, context.Canceled) || errors.Is(stats.CollectionError, runlock.ErrLost) || errors.Is(stats.CollectionError, runlock.ErrUnavailable) {
		return "failed", fmt.Errorf("collection canceled or infrastructure unavailable: %w", stats.CollectionError)
	}
	if stats.Adapters.Selected == stats.Adapters.Successes && stats.CollectionFailed == 0 {
		return "success", nil
	}
	if stats.Adapters.Selected > 0 && stats.Adapters.Successes*100 >= stats.Adapters.Selected*threshold {
		return "partial_success", nil
	}
	return "failed", collectionFailure{stats.CollectionFailed, stats.CollectionError}
}

var httpEvidence = regexp.MustCompile(`(?i)(?:http(?: status)?|status(?: code| inesperado)?)[ :=]+([45][0-9]{2})\b`)

func diagnoseAdapter(t adapterTask, err error) AdapterFailure {
	id := taskSourceName(t)
	if a, ok := t.adapter.(ports.StableJobSource); ok {
		id = a.SourceID()
	}
	d := AdapterFailure{Provider: t.provider, Adapter: id, Category: "unknown", Error: err.Error()}
	var dns *net.DNSError
	var op *net.OpError
	var timeout net.Error
	var rate *ports.RateLimitError
	switch {
	case errors.Is(err, context.Canceled):
		d.Category = "canceled"
	case errors.Is(err, context.DeadlineExceeded):
		d.Category = "timeout"
	case errors.As(err, &dns):
		d.Category = "dns"
	case errors.As(err, &timeout) && timeout.Timeout():
		d.Category = "timeout"
	case errors.As(err, &op) && op.Op == "dial":
		d.Category = "connection"
	}
	if errors.As(err, &rate) {
		d.HTTPStatus = 429
	} else if m := httpEvidence.FindStringSubmatch(err.Error()); len(m) > 1 {
		d.HTTPStatus, _ = strconv.Atoi(m[1])
	}
	if d.HTTPStatus == 429 {
		d.Category = "rate_limit"
	} else if d.HTTPStatus >= 500 {
		d.Category = "http_5xx"
	} else if d.HTTPStatus >= 400 {
		d.Category = "http_4xx"
	}
	return d
}

type ExecutionReport struct {
	RunID                 string           `json:"run_id"`
	Providers             []string         `json:"providers"`
	Window                string           `json:"window"`
	StartedAt             time.Time        `json:"started_at"`
	FinishedAt            time.Time        `json:"finished_at"`
	DurationSeconds       float64          `json:"duration_seconds"`
	Status                string           `json:"status"`
	CollectionStatus      string           `json:"collection_status"`
	Reason                string           `json:"reason"`
	Adapters              AdapterTotals    `json:"adapters"`
	Pipeline              ProcessStats     `json:"pipeline"`
	ConfiguredConcurrency int              `json:"configured_concurrency"`
	EffectiveConcurrency  int              `json:"effective_concurrency"`
	AdaptersPerMinute     float64          `json:"adapters_per_minute"`
	TimeoutSeconds        float64          `json:"timeout_seconds"`
	DeadlineReached       bool             `json:"deadline_reached"`
	Failures              []AdapterFailure `json:"failures"`
}

func EmitReport(runID string, providers []string, window string, start time.Time, timeout time.Duration, concurrency int, stats ProcessStats, err error) ExecutionReport {
	status := stats.OperationalStatus
	if status == "" {
		status = "success"
	}
	if err != nil {
		status = "failed"
	}
	technical := "success"
	if stats.CollectionFailed > 0 || stats.DeadlineReached || stats.Adapters.Selected > stats.Adapters.Successes {
		technical = "failed"
	}
	reason := "completed"
	if status == "partial_success" {
		reason = "isolated_collection_failures"
	}
	if err != nil {
		reason = err.Error()
	}
	end := time.Now().UTC()
	duration := end.Sub(start).Seconds()
	report := ExecutionReport{RunID: runID, Providers: providers, Window: window, StartedAt: start.UTC(), FinishedAt: end, DurationSeconds: duration, Status: status, CollectionStatus: technical, Reason: reason, Adapters: stats.Adapters, Pipeline: stats, ConfiguredConcurrency: concurrency, EffectiveConcurrency: stats.EffectiveConcurrency, TimeoutSeconds: timeout.Seconds(), DeadlineReached: stats.DeadlineReached || errors.Is(err, context.DeadlineExceeded) && stats.CollectionFailed == 0, Failures: stats.Failures}
	if duration > 0 {
		report.AdaptersPerMinute = float64(stats.Adapters.Completed) * 60 / duration
	}
	slog.Info("scraper execution report", "report", report)
	slog.Info(fmt.Sprintf("Coleta %s | provider=%v janela=%s | status=%s coleta=%s motivo=%s | adapters selecionados=%d despachados=%d concluídos=%d sucesso=%d falhas=%d timeouts=%d cancelamentos=%d não_despachados=%d taxa=%.2f%% | vagas coletadas=%d válidas=%d inválidas=%d duplicadas=%d classificadas=%d aprovadas=%d rejeitadas=%d criadas=%d atualizadas=%d persistidas=%d indexadas=%d falhas_pipeline=%d | duração=%.3fs concorrência=%d/%d adapters/min=%.2f deadline=%t", runID, providers, window, status, technical, reason, stats.Adapters.Selected, stats.Adapters.Dispatched, stats.Adapters.Completed, stats.Adapters.Successes, stats.Adapters.Failures, stats.Adapters.Timeouts, stats.Adapters.Cancellations, stats.Adapters.Undispatched, stats.Adapters.SuccessRate, stats.Collected, stats.Valid, stats.Invalid, stats.Duplicates, stats.Classified, stats.Approved, stats.Rejected, stats.Inserted, stats.Updated, stats.Saved(), stats.Indexed, stats.Failed, duration, stats.EffectiveConcurrency, concurrency, report.AdaptersPerMinute, report.DeadlineReached))
	return report
}
