package pipeline

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
)

func recoveryConfig(saved *atomic.Int32) processConfig {
	return processConfig{
		ClassificationBatchSize: 10, PersistBatchSize: 10, IndexBatchSize: 10,
		Persist: func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			if err := ctx.Err(); err != nil {
				return jobstore.SaveResult{}, err
			}
			saved.Add(int32(len(jobs)))
			return jobstore.SaveResult{Inserted: len(jobs), Persisted: jobs}, nil
		},
		Index: func(ctx context.Context, _ []domain.Job) error { return ctx.Err() },
	}
}

func TestCollectionRecoveryKeepsJobsReturnedWithAdapterError(t *testing.T) {
	var saved atomic.Int32
	sources := []ports.JobSource{
		schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) {
			return []domain.Job{inScopeJob(1)}, errors.New("later page failed")
		}},
		schedulerTestAdapter{provider: ports.ProviderAdzuna, search: func(context.Context, string) ([]domain.Job, error) {
			return []domain.Job{inScopeJob(2)}, nil
		}},
	}
	jobs, stats, err := runWithConcurrency(context.Background(), sources, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 2}, 1, nil, recoveryConfig(&saved))
	require.NoError(t, err) // Adapter errors remain isolated; their metrics retain the failure.
	require.Len(t, jobs, 2)
	require.EqualValues(t, 2, saved.Load())
	require.Equal(t, 2, stats.Indexed)
}

func TestCollectionRecoveryDrainsAfterTimeoutWithoutLosingCommittedJobs(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())
	var saved atomic.Int32
	committed := make(chan struct{})
	cfg := recoveryConfig(&saved)
	cfg.ClassificationBatchSize, cfg.IndexBatchSize = 1, 1
	cfg.CollectionTimeout, cfg.DrainTimeout = 100*time.Millisecond, time.Second
	persist := cfg.Persist
	cfg.Persist = func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
		r, err := persist(ctx, jobs)
		if saved.Load() == 1 {
			close(committed)
		}
		return r, err
	}
	sources := []ports.JobSource{
		schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(1)}, nil }},
		schedulerTestAdapter{provider: ports.ProviderAdzuna, search: func(ctx context.Context, _ string) ([]domain.Job, error) {
			<-committed
			<-ctx.Done()
			return []domain.Job{inScopeJob(2)}, ctx.Err()
		}},
	}
	jobs, stats, err := runWithConcurrency(context.Background(), sources, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 2}, 1, nil, cfg)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Len(t, jobs, 2)
	require.EqualValues(t, 2, saved.Load())
	require.Equal(t, 2, stats.Saved())
	require.Equal(t, 2, stats.Indexed)
}

func TestCollectionRecoveryFlushesSmallPartialBatchAfterTimeout(t *testing.T) {
	var saved atomic.Int32
	cfg := recoveryConfig(&saved)
	cfg.CollectionTimeout, cfg.DrainTimeout = 10*time.Millisecond, time.Second
	source := schedulerTestAdapter{provider: ports.ProviderGupy, search: func(ctx context.Context, _ string) ([]domain.Job, error) {
		<-ctx.Done()
		return []domain.Job{inScopeJob(1)}, ctx.Err()
	}}
	_, stats, err := runWithConcurrency(context.Background(), []ports.JobSource{source}, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1}, 1, nil, cfg)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.EqualValues(t, 1, saved.Load())
	require.Equal(t, 1, stats.Indexed)
}

func TestCollectionRecoveryProcessingFailureNeverReportsSuccess(t *testing.T) {
	for _, stage := range []string{"persist", "index"} {
		t.Run(stage, func(t *testing.T) {
			var saved atomic.Int32
			cfg := recoveryConfig(&saved)
			failure := errors.New(stage + " failed")
			if stage == "persist" {
				cfg.Persist = func(context.Context, []domain.Job) (jobstore.SaveResult, error) {
					return jobstore.SaveResult{}, failure
				}
			} else {
				cfg.Index = func(context.Context, []domain.Job) error { return failure }
			}
			source := schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(1)}, nil }}
			_, stats, err := runWithConcurrency(context.Background(), []ports.JobSource{source}, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1}, 1, nil, cfg)
			require.ErrorIs(t, err, failure)
			require.Zero(t, stats.Indexed)
			if stage == "persist" {
				require.Zero(t, stats.Saved())
			} else {
				require.Equal(t, 1, stats.Saved())
			}
		})
	}
}

func TestCollectionRecoveryIndexFailureDoesNotAdvanceDurableCheckpoint(t *testing.T) {
	catalog := &observedCatalog{}
	cfg := defaultProcessConfig()
	cfg.Store = jobstore.NewDurable(nil, catalog)
	cfg.Index = func(context.Context, []domain.Job) error { return errors.New("projection unavailable") }
	_, stats, err := processIncomingJobs(context.Background(), feedJobs(committedIndexJob()), cfg)
	require.Error(t, err)
	require.Equal(t, 1, stats.Saved())
	require.Zero(t, catalog.marks)
}

func TestCollectionRecoveryBoundsDrainAndRespectsShutdown(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())
	for _, shutdown := range []bool{false, true} {
		parent, cancel := context.WithCancel(context.Background())
		var saved atomic.Int32
		cfg := recoveryConfig(&saved)
		cfg.CollectionTimeout, cfg.DrainTimeout = 10*time.Millisecond, 20*time.Millisecond
		cfg.Persist = func(ctx context.Context, _ []domain.Job) (jobstore.SaveResult, error) {
			if shutdown {
				cancel()
			}
			<-ctx.Done()
			return jobstore.SaveResult{}, ctx.Err()
		}
		source := schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(1)}, nil }}
		started := time.Now()
		_, _, err := runWithConcurrency(parent, []ports.JobSource{source}, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1}, 1, nil, cfg)
		cancel()
		require.Error(t, err)
		require.Less(t, time.Since(started), time.Second)
		if shutdown {
			require.ErrorIs(t, err, context.Canceled)
		} else {
			require.ErrorIs(t, err, context.DeadlineExceeded)
		}
	}
}
