package linkedin

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
)

type progressKey struct{}
type batchProgress struct {
	runID              string
	generation         uint64
	selected, position int
	started            time.Time
	keywordHadError    bool
}

func observeBatch(ctx context.Context, runID string, selected int) context.Context {
	return context.WithValue(ctx, progressKey{}, &batchProgress{runID: runID, generation: metrics.BeginLinkedInProgress(runID, selected), selected: selected, started: time.Now()})
}
func fullCoverageCount(keywords []string) int {
	seen := map[string]bool{}
	for _, k := range keywords {
		if k = strings.TrimSpace(k); k != "" {
			seen[k] = true
		}
	}
	return len(seen)
}
func observe(ctx context.Context, e metrics.LinkedInProgressEvent, duration time.Duration, err error) {
	p, ok := ctx.Value(progressKey{}).(*batchProgress)
	if !ok {
		return
	}
	if e.Kind == "keyword_started" {
		p.position++
		p.keywordHadError = false
	}
	if e.Kind == "http_finished" && err != nil {
		p.keywordHadError = true
	}
	if e.Kind == "keyword_finished" {
		e.Failed = err != nil
		e.HadError = p.keywordHadError || err != nil
	}
	var networkError net.Error
	e.Timeout = errors.Is(err, context.DeadlineExceeded) || (errors.As(err, &networkError) && networkError.Timeout())
	metrics.ObserveLinkedInProgress(p.runID, p.generation, e)
	attrs := []any{"run_id", p.runID, "provider", "linkedin", "event", e.Kind, "keyword", e.Keyword, "keyword_position", p.position, "keywords_selected", p.selected, "page", e.Page, "offset", e.Offset, "received", e.Received, "http_status", e.HTTPStatus, "duration_seconds", duration.Seconds(), "elapsed_seconds", time.Since(p.started).Seconds(), "last_activity", time.Now().UTC()}
	if e.Kind == "keyword_finished" {
		attrs = append(attrs, "status", metrics.Status(err), "had_error", e.HadError)
	}
	if err != nil {
		attrs = append(attrs, "error", err.Error(), "error_type", metrics.ErrorType(err))
	}
	slog.Info("linkedin collection progress", attrs...)
}
