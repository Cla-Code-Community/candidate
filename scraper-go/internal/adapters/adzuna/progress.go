package adzuna

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/url"
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
	secrets            []string
}

func observeBatch(ctx context.Context, runID string, selected int, secrets ...string) context.Context {
	return context.WithValue(ctx, progressKey{}, &batchProgress{runID: runID, generation: metrics.BeginAdzunaProgress(runID, selected), selected: selected, started: time.Now(), secrets: secrets})
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
func observe(ctx context.Context, e metrics.AdzunaProgressEvent, duration time.Duration, err error) {
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
	metrics.ObserveAdzunaProgress(p.runID, p.generation, e)
	page, _ := ctx.Value(pageProgressKey{}).(pageProgress)
	if e.Page == 0 {
		e.Page = page.page
	}
	progress := 0.0
	finished := p.position
	if e.Kind != "keyword_finished" {
		finished--
	}
	if p.selected > 0 {
		progress = 100 * float64(max(0, finished)) / float64(p.selected)
	}
	attrs := []any{"run_id", p.runID, "provider", "adzuna", "event", e.Kind, "keyword", e.Keyword, "keyword_position", p.position, "keywords_selected", p.selected, "page", e.Page, "offset", e.Offset, "received", e.Received, "http_status", e.HTTPStatus, "duration_seconds", duration.Seconds(), "elapsed_seconds", time.Since(p.started).Seconds(), "last_activity", time.Now().UTC(), "attempt", page.attempt, "progress_percent", progress}
	if e.Kind == "keyword_finished" {
		attrs = append(attrs, "status", metrics.Status(err), "had_error", e.HadError)
	}
	if err != nil {
		attrs = append(attrs, "error", safeProgressError(err, p.secrets), "error_type", metrics.ErrorType(err))
	}
	slog.Info("adzuna collection progress", attrs...)
}

// Page and attempt metadata are observational only; they never control pagination.
type pageProgressKey struct{}
type pageProgress struct{ page, attempt int }

func safeProgressError(err error, secrets []string) string {
	message := err.Error()
	for _, secret := range secrets {
		if secret != "" {
			message = strings.ReplaceAll(message, url.QueryEscape(secret), "[redacted]")
			message = strings.ReplaceAll(message, secret, "[redacted]")
		}
	}
	return message
}
