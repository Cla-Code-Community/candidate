package pipeline

import (
	"context"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
	"sync/atomic"
	"testing"
	"time"
)

func TestAbsoluteDeadlineIncludesFinalizationAndJoinsWorkers(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())
	var saved atomic.Int32
	cfg := recoveryConfig(&saved)
	cfg.ClassificationBatchSize = 1
	cfg.PersistBatchSize = 1
	cfg.IndexBatchSize = 1
	start := time.Now()
	deadline := start.Add(150 * time.Millisecond)
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()
	cfg.CollectionDeadline = start.Add(70 * time.Millisecond)
	cfg.Index = func(ctx context.Context, _ []domain.Job) error { <-ctx.Done(); return ctx.Err() }
	source := schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(1)}, nil }}
	_, stats, err := runWithConcurrency(ctx, []ports.JobSource{source}, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1}, 1, nil, cfg)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.EqualValues(t, 1, saved.Load())
	require.Equal(t, 1, stats.Saved())
	require.Zero(t, stats.Indexed)
	require.Less(t, time.Since(start), time.Second)
}
