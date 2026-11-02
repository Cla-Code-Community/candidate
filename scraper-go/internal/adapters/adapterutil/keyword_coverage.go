package adapterutil

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

// SearchAllKeywords executes each configured query at most once in input order.
// Pagination/retries remain in the adapter. A source rate limit stops this batch;
// its typed error reaches the existing provider Retry-After coordination.
func SearchAllKeywords(ctx context.Context, keywords []string, req domain.ScrapeRequest, provider ports.ProviderID,
	search func(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error),
) (jobs []domain.Job, runErr error) {
	queries := make([]string, 0, len(keywords))
	seen := make(map[string]bool, len(keywords))
	for _, keyword := range keywords {
		if keyword = strings.TrimSpace(keyword); keyword != "" && !seen[keyword] {
			seen[keyword] = true
			queries = append(queries, keyword)
		}
	}
	started, completed, failed := 0, 0, 0
	defer func() {
		status := "complete"
		if runErr != nil || completed != len(queries) {
			status = "partial"
		}
		slog.Info("provider keyword coverage", "provider", provider, "run_id", req.RunID, "window_id", req.WindowID,
			"planned", len(queries), "started", started, "completed", completed, "failed", failed, "not_executed", len(queries)-started, "status", status)
	}()
	for _, keyword := range queries {
		if cause := context.Cause(ctx); cause != nil {
			return jobs, errors.Join(runErr, cause)
		}
		started++
		found, err := search(ctx, keyword, req)
		jobs = append(jobs, found...)
		if err == nil {
			completed++
			continue
		}
		failed++
		runErr = errors.Join(runErr, err)
		var limit *ports.RateLimitError
		if errors.As(err, &limit) {
			return jobs, runErr
		}
		if cause := context.Cause(ctx); cause != nil {
			return jobs, errors.Join(runErr, cause)
		}
	}
	return jobs, runErr
}
