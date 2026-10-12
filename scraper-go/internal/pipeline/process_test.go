package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/classifier"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/alicebob/miniredis/v2"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
)

func inScopeJob(i int) domain.Job {
	return domain.Job{
		Title:       "Backend Engineer",
		Company:     fmt.Sprintf("Acme-%d", i),
		Location:    "Brasil",
		Description: "Golang go APIs microservices postgresql redis",
		Source:      "gupy",
		Keyword:     "go",
	}
}

func feedJobs(jobs ...domain.Job) <-chan domain.Job {
	ch := make(chan domain.Job, len(jobs))
	for _, job := range jobs {
		ch <- job
	}
	close(ch)
	return ch
}

func TestProcessIncomingJobsDedupesSameAndCrossBatch(t *testing.T) {
	cfg := processConfig{
		RunID:                   "run-dedup",
		ClassificationBatchSize: 2,
		PersistBatchSize:        2,
		IndexBatchSize:          2,
	}

	jobs := []domain.Job{
		inScopeJob(1),
		inScopeJob(1), // same batch duplicate
		inScopeJob(2),
		inScopeJob(2), // next batch duplicate of previous identity after flush of 1+2 unique...
	}
	// With batch size 2: first unique is job1, second unique is job2 (dup of job1 counted).
	// After flush of [1,2], incoming dup of job2 is cross-batch.

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg)
	require.NoError(t, err)
	assert.Equal(t, 4, stats.Received)
	assert.Equal(t, 2, stats.Duplicates)
	assert.Len(t, got, 2)
}

func TestProcessIncomingJobsEquivalentURLsAndSameTitleDifferentJobs(t *testing.T) {
	cfg := processConfig{ClassificationBatchSize: 10, PersistBatchSize: 10, IndexBatchSize: 10}
	jobs := []domain.Job{
		{
			Title:       "Backend Engineer",
			Company:     "URLCo",
			Location:    "Remote",
			URL:         "https://jobs.example.com/go?utm=1",
			Description: "Golang APIs microservices",
		},
		{
			Title:       "Backend Engineer",
			Company:     "URLCo",
			Location:    "Remote",
			URL:         "https://jobs.example.com/go/",
			Description: "Golang APIs microservices",
		},
		{
			Title:       "Backend Engineer",
			Company:     "OtherCo",
			Location:    "Brasil",
			URL:         "https://other.example.com/go",
			Description: "Golang APIs microservices",
		},
	}

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg)
	require.NoError(t, err)
	assert.Equal(t, 1, stats.Duplicates)
	assert.Len(t, got, 2)
	assert.Equal(t, "Backend Engineer", got[0].Title)
}

func TestProcessIncomingJobsBatchOutputMatchesIndividualClassify(t *testing.T) {
	jobs := []domain.Job{inScopeJob(1), inScopeJob(2), inScopeJob(3), inScopeJob(4), inScopeJob(5)}
	cfg := processConfig{ClassificationBatchSize: 2, PersistBatchSize: 2, IndexBatchSize: 2}

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg)
	require.NoError(t, err)
	assert.Equal(t, 5, stats.Classified)
	require.Len(t, got, 5)

	for i, job := range jobs {
		individual := classifier.Classify(job)
		require.NotNil(t, got[i].Classification)
		assert.Equal(t, individual.PrimaryFamily, got[i].Classification.PrimaryFamily)
		assert.Equal(t, individual.InScope, got[i].Classification.InScope)
		assert.Equal(t, individual.Confidence, got[i].Classification.Confidence)
	}
}

func TestProcessIncomingJobsLastBatchSmallerAndEmpty(t *testing.T) {
	t.Run("last batch smaller", func(t *testing.T) {
		var persistSizes []int
		cfg := processConfig{
			ClassificationBatchSize: 3,
			PersistBatchSize:        3,
			IndexBatchSize:          3,
			Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
				persistSizes = append(persistSizes, len(jobs))
				return jobstore.SaveResult{Inserted: len(jobs), Persisted: jobs}, nil
			},
		}
		jobs := []domain.Job{inScopeJob(1), inScopeJob(2), inScopeJob(3), inScopeJob(4), inScopeJob(5)}
		_, _, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg)
		require.NoError(t, err)
		assert.Equal(t, []int{3, 2}, persistSizes)
	})

	t.Run("empty", func(t *testing.T) {
		got, stats, err := processIncomingJobs(context.Background(), feedJobs(), defaultProcessConfig())
		require.NoError(t, err)
		assert.Empty(t, got)
		assert.Equal(t, 0, stats.Received)
	})
}

func TestProcessIncomingJobsInvalidAndCancelBetweenBatches(t *testing.T) {
	t.Run("invalid isolated", func(t *testing.T) {
		cfg := processConfig{
			ClassificationBatchSize: 10,
			Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
				assert.Len(t, jobs, 1)
				return jobstore.SaveResult{Persisted: jobs}, nil
			},
		}
		_, stats, err := processIncomingJobs(context.Background(), feedJobs(
			domain.Job{Title: "sem identidade"},
			inScopeJob(1),
		), cfg)
		require.NoError(t, err)
		assert.Equal(t, 1, stats.Invalid)
		assert.Equal(t, 1, stats.Approved)
	})

	t.Run("cancel between batches", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		var persistCalls atomic.Int32
		cfg := processConfig{
			ClassificationBatchSize: 2,
			PersistBatchSize:        2,
			IndexBatchSize:          2,
			Persist: func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
				n := persistCalls.Add(1)
				if n == 1 {
					cancel()
				}
				return jobstore.SaveResult{Persisted: append([]domain.Job(nil), jobs...)}, nil
			},
		}
		jobs := []domain.Job{inScopeJob(1), inScopeJob(2), inScopeJob(3), inScopeJob(4)}
		_, stats, err := processIncomingJobs(ctx, feedJobs(jobs...), cfg)
		require.Error(t, err)
		assert.Equal(t, int32(1), persistCalls.Load())
		assert.Equal(t, 2, stats.Approved)
	})
}

func TestProcessIncomingJobsDoesNotIndexFailedPersistBatch(t *testing.T) {
	indexed := false
	cfg := processConfig{
		ClassificationBatchSize: 10,
		Persist: func(context.Context, []domain.Job) (jobstore.SaveResult, error) {
			return jobstore.SaveResult{}, errors.New("persist failed")
		},
		Index: func(context.Context, []domain.Job) error {
			indexed = true
			return nil
		},
	}

	_, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1)), cfg)
	require.Error(t, err)
	assert.False(t, indexed)
	assert.Equal(t, 1, stats.Failed)
	assert.Equal(t, 0, stats.Indexed)
}

func TestProcessIncomingJobsIndexesOnlyPersistedIDs(t *testing.T) {
	var indexed []string
	persisted := inScopeJob(1)
	persisted.ID = "persisted-1"
	cfg := processConfig{
		ClassificationBatchSize: 10,
		PersistBatchSize:        10,
		IndexBatchSize:          10,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			return jobstore.SaveResult{Inserted: 1, Persisted: []domain.Job{persisted}}, nil
		},
		Index: func(_ context.Context, jobs []domain.Job) error {
			for _, job := range jobs {
				indexed = append(indexed, job.ID)
			}
			return nil
		},
	}

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1), inScopeJob(2)), cfg)
	require.NoError(t, err)
	assert.Equal(t, []string{"persisted-1"}, indexed)
	require.Len(t, got, 1)
	assert.Equal(t, "persisted-1", got[0].ID)
	assert.Equal(t, 1, stats.Indexed)
}

func TestProcessIncomingJobsIndexPartialFailureReconciles(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	store := jobstore.New(rdb)

	calls := 0
	cfg := processConfig{
		RunID:                   "run-index",
		Keywords:                []string{"go"},
		ClassificationBatchSize: 10,
		PersistBatchSize:        10,
		IndexBatchSize:          10,
		Store:                   store,
		RDB:                     rdb,
		Index: func(ctx context.Context, jobs []domain.Job) error {
			calls++
			if calls == 1 {
				return errors.New("partial index failure")
			}
			return nil
		},
	}

	_, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1)), cfg)
	require.NoError(t, err)
	assert.Equal(t, 1, stats.Failed)
	assert.Equal(t, 1, stats.Indexed)
	members, err := rdb.SMembers(context.Background(), "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.NotEmpty(t, members)
}

func TestProcessIncomingJobsRespectsIndexBatchSize(t *testing.T) {
	var sizes []int
	cfg := processConfig{
		ClassificationBatchSize: 10,
		PersistBatchSize:        10,
		IndexBatchSize:          2,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			out := make([]domain.Job, len(jobs))
			copy(out, jobs)
			for i := range out {
				out[i].ID = fmt.Sprintf("id-%d", i)
			}
			return jobstore.SaveResult{Inserted: len(out), Persisted: out}, nil
		},
		Index: func(_ context.Context, jobs []domain.Job) error {
			sizes = append(sizes, len(jobs))
			return nil
		},
	}

	jobs := []domain.Job{inScopeJob(1), inScopeJob(2), inScopeJob(3), inScopeJob(4), inScopeJob(5)}
	_, _, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg)
	require.NoError(t, err)
	assert.Equal(t, []int{2, 2, 1}, sizes)
}

func TestProcessIncomingJobsCancelBeforeNextIndexBatch(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var indexCalls atomic.Int32
	cfg := processConfig{
		ClassificationBatchSize: 10,
		PersistBatchSize:        10,
		IndexBatchSize:          2,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			out := append([]domain.Job(nil), jobs...)
			for i := range out {
				out[i].ID = fmt.Sprintf("id-%d", i)
			}
			return jobstore.SaveResult{Persisted: out}, nil
		},
		Index: func(ctx context.Context, jobs []domain.Job) error {
			indexCalls.Add(1)
			cancel()
			return nil
		},
	}

	_, stats, err := processIncomingJobs(ctx, feedJobs(inScopeJob(1), inScopeJob(2), inScopeJob(3), inScopeJob(4)), cfg)
	require.Error(t, err)
	assert.Equal(t, int32(1), indexCalls.Load())
	assert.Equal(t, 2, stats.Indexed)
}

func TestStageQueueCapacityIsBounded(t *testing.T) {
	cfg := processConfig{ClassificationBatchSize: 100, PersistBatchSize: 100, IndexBatchSize: 250}
	assert.Equal(t, 500, stageQueueCapacity(cfg))
	cfg = processConfig{ClassificationBatchSize: 1, PersistBatchSize: 1, IndexBatchSize: 1}
	assert.Equal(t, 2, stageQueueCapacity(cfg))
}

func TestProcessIncomingJobsBackpressureSlowsProducer(t *testing.T) {
	cfg := processConfig{
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		Persist: func(context.Context, []domain.Job) (jobstore.SaveResult, error) {
			time.Sleep(40 * time.Millisecond)
			return jobstore.SaveResult{Persisted: []domain.Job{inScopeJob(0)}}, nil
		},
	}
	incoming := make(chan domain.Job, stageQueueCapacity(cfg))
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _, _ = processIncomingJobs(context.Background(), incoming, cfg)
	}()

	started := time.Now()
	for i := 0; i < 6; i++ {
		incoming <- inScopeJob(i)
	}
	close(incoming)
	<-done
	assert.Greater(t, time.Since(started), 120*time.Millisecond)
}

func TestRunWithConcurrencyCancelUnblocksAndDoesNotLeak(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

	started := make(chan struct{})
	adapter := schedulerTestAdapter{
		provider: ports.ProviderGupy,
		search: func(ctx context.Context, _ string) ([]domain.Job, error) {
			select {
			case <-started:
			default:
				close(started)
			}
			jobs := make([]domain.Job, 0, 20)
			for i := 0; i < 20; i++ {
				jobs = append(jobs, inScopeJob(i))
			}
			return jobs, nil
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	cfg := processConfig{
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		Persist: func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			select {
			case <-ctx.Done():
				return jobstore.SaveResult{}, context.Cause(ctx)
			case <-time.After(50 * time.Millisecond):
				return jobstore.SaveResult{Persisted: jobs}, nil
			}
		},
	}

	done := make(chan error, 1)
	go func() {
		_, _, err := runWithConcurrency(
			ctx,
			[]ports.JobSource{adapter},
			domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1},
			1,
			nil,
			cfg,
		)
		done <- err
	}()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("adapter did not start")
	}
	cancel()

	select {
	case err := <-done:
		require.Error(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("run did not return after cancel")
	}
}

func TestProcessIncomingJobsCancelUnblocksProducer(t *testing.T) {
	defer goleak.VerifyNone(t, goleak.IgnoreCurrent())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	cfg := processConfig{
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		Persist: func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			<-ctx.Done()
			return jobstore.SaveResult{}, context.Cause(ctx)
		},
	}
	incoming := make(chan domain.Job)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		_, _, _ = processIncomingJobs(ctx, incoming, cfg)
	}()

	incoming <- inScopeJob(1)
	time.Sleep(20 * time.Millisecond)
	cancel()

	sent := make(chan struct{})
	go func() {
		incoming <- inScopeJob(2)
		close(sent)
	}()

	select {
	case <-sent:
	case <-time.After(time.Second):
		t.Fatal("producer remained blocked after cancel")
	}
	close(incoming)
	wg.Wait()
}

func TestProcessIncomingJobsIndexesSuccessfulPersistBeforeLaterFailure(t *testing.T) {
	var indexed []string
	var persistCalls int
	cfg := processConfig{
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          10,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			persistCalls++
			if persistCalls == 2 {
				return jobstore.SaveResult{}, errors.New("persist failed")
			}
			out := append([]domain.Job(nil), jobs...)
			out[0].ID = fmt.Sprintf("ok-%d", persistCalls)
			return jobstore.SaveResult{Inserted: 1, Persisted: out}, nil
		},
		Index: func(_ context.Context, jobs []domain.Job) error {
			for _, job := range jobs {
				indexed = append(indexed, job.ID)
			}
			return nil
		},
	}

	_, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1), inScopeJob(2), inScopeJob(3)), cfg)
	require.Error(t, err)
	assert.Equal(t, []string{"ok-1"}, indexed)
	assert.Equal(t, 1, stats.Indexed)
	assert.Equal(t, 1, stats.Failed)
	assert.NotContains(t, indexed, "")
}

func TestProcessIncomingJobsMergesDuplicateAfterFlush(t *testing.T) {
	persistCalls := 0
	cfg := processConfig{
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			persistCalls++
			out := append([]domain.Job(nil), jobs...)
			for i := range out {
				if out[i].ID == "" {
					out[i].ID = jobstore.StableID(&out[i])
				}
			}
			result := jobstore.SaveResult{Persisted: out}
			if persistCalls == 1 {
				result.Inserted = len(out)
			} else {
				result.Updated = len(out)
			}
			return result, nil
		},
	}

	first := inScopeJob(1)
	first.Source = "gupy"
	first.URL = "https://gupy.example/job-1"
	first.Description = "Golang go APIs"
	first.Keyword = "go"

	second := inScopeJob(1)
	second.Source = "linkedin"
	second.URL = "https://linkedin.example/jobs/job-1-backend"
	second.Description = "Golang go APIs microservices postgresql redis kafka"
	second.Keyword = "golang"

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(first, second), cfg)
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, 1, stats.Duplicates)
	assert.Equal(t, 1, stats.Inserted)
	assert.Equal(t, 1, stats.Updated)
	assert.Equal(t, 2, stats.Saved())
	assert.Equal(t, 2, persistCalls)
	assert.ElementsMatch(t, []string{"gupy", "linkedin"}, got[0].Sources)
	assert.ElementsMatch(t, []string{"go", "golang"}, got[0].Keywords)
	assert.Contains(t, got[0].Description, "kafka")
	assert.Contains(t, got[0].URL, "linkedin")
}

func TestProcessIncomingJobsPublishesBatchesAndDropsStaleKeywords(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	store := jobstore.New(rdb)

	first := inScopeJob(1)
	first.Source = "gupy"
	first.Description = "Golang go python APIs microservices"
	second := inScopeJob(2)
	second.Description = "Golang go APIs microservices"
	late := inScopeJob(1)
	late.Source = "linkedin"
	late.Description = "Golang go APIs microservices postgresql redis kafka"

	cfg := processConfig{
		RunID:                   "run-idx",
		Keywords:                []string{"go", "python"},
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		Store:                   store,
		RDB:                     rdb,
	}

	got, stats, err := processIncomingJobs(context.Background(), feedJobs(first, second, late), cfg)
	require.NoError(t, err)
	require.Len(t, got, 2)
	assert.Equal(t, 1, stats.Duplicates)
	assert.Equal(t, 2, stats.Inserted)
	assert.Equal(t, 1, stats.Updated)

	var job1ID, job2ID string
	for _, job := range got {
		switch job.Company {
		case "Acme-1":
			job1ID = job.ID
			assert.ElementsMatch(t, []string{"gupy", "linkedin"}, job.Sources)
		case "Acme-2":
			job2ID = job.ID
		}
	}
	require.NotEmpty(t, job1ID)
	require.NotEmpty(t, job2ID)

	ctx := context.Background()
	goMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{job1ID, job2ID}, goMembers)

	pythonMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:python").Result()
	require.NoError(t, err)
	assert.NotContains(t, pythonMembers, job1ID)

	nextExists, err := rdb.Exists(ctx, "scraper:jobs:keyword:go:next").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), nextExists)
	nextRunExists, err := rdb.Exists(ctx, "scraper:jobs:keyword:go:next:run-idx").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), nextRunExists)
}

func TestProcessIncomingJobsDoesNotPublishIndexesWhenPersistFails(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := processConfig{
		RunID:                   "run-fail",
		Keywords:                []string{"go"},
		ClassificationBatchSize: 1,
		PersistBatchSize:        1,
		IndexBatchSize:          1,
		RDB:                     rdb,
		Persist: func(context.Context, []domain.Job) (jobstore.SaveResult, error) {
			return jobstore.SaveResult{}, errors.New("persist failed")
		},
	}

	_, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1)), cfg)
	require.Error(t, err)
	assert.Equal(t, 1, stats.Failed)
	nextExists, existsErr := rdb.Exists(context.Background(), "scraper:jobs:keyword:go:next:run-fail").Result()
	require.NoError(t, existsErr)
	assert.Equal(t, int64(0), nextExists)
	liveExists, existsErr := rdb.Exists(context.Background(), "scraper:jobs:keyword:go").Result()
	require.NoError(t, existsErr)
	assert.Equal(t, int64(0), liveExists)
}

func TestProcessIncomingJobsDoesNotReconcileWithoutPersistedIDs(t *testing.T) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cfg := processConfig{
		ClassificationBatchSize: 10,
		PersistBatchSize:        10,
		IndexBatchSize:          10,
		Store:                   jobstore.New(rdb),
		RDB:                     rdb,
		Persist: func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
			out := append([]domain.Job(nil), jobs...)
			for i := range out {
				out[i].ID = ""
			}
			return jobstore.SaveResult{Persisted: out}, nil
		},
		Index: func(context.Context, []domain.Job) error {
			return errors.New("index failed")
		},
	}

	_, stats, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1)), cfg)
	require.Error(t, err)
	assert.Equal(t, 1, stats.Failed)
	assert.Equal(t, 0, stats.Indexed)
}

func TestRunSnapshotObservesProcessingWithoutChangingResults(t *testing.T) {
	metrics.StartRun("manual", time.Now(), "pipeline-observation")
	defer metrics.FinishRun(nil, "pipeline-observation")
	cfg := processConfig{RunID: "pipeline-observation", ClassificationBatchSize: 10, PersistBatchSize: 10}
	cfg.Persist = func(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
		return jobstore.SaveResult{Inserted: len(jobs), Persisted: jobs}, nil
	}
	rejected := inScopeJob(2)
	rejected.Title = "Auxiliar Administrativo"
	rejected.Description = "Rotinas administrativas e atendimento ao público"
	invalid := domain.Job{Source: "gupy"}
	got, _, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1), rejected, invalid), cfg)
	require.NoError(t, err)
	require.Len(t, got, 1)
	s := metrics.Current()
	require.NotNil(t, s.Classification)
	require.NotNil(t, s.Persistence)
	assert.Equal(t, 3, s.Classification.Received)
	assert.Equal(t, 2, s.Classification.Classified)
	assert.Equal(t, 1, s.Classification.Approved)
	assert.Equal(t, 1, s.Classification.Rejected)
	assert.Equal(t, 1, s.Classification.Invalid)
	assert.Equal(t, 1, s.Persistence.Received)
	assert.Equal(t, 1, s.Persistence.Inserted)
}
func TestRunSnapshotObservesTerminalPersistenceFailure(t *testing.T) {
	metrics.StartRun("manual", time.Now(), "pipeline-failure")
	defer metrics.FinishRun(errors.New("failure"), "pipeline-failure")
	cfg := processConfig{RunID: "pipeline-failure", ClassificationBatchSize: 2, PersistBatchSize: 2}
	cfg.Persist = func(context.Context, []domain.Job) (jobstore.SaveResult, error) {
		return jobstore.SaveResult{}, errors.New("failure")
	}
	_, _, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1), inScopeJob(2)), cfg)
	require.Error(t, err)
	p := metrics.Current().Persistence
	require.NotNil(t, p)
	assert.Equal(t, 2, p.Received)
	assert.Equal(t, 2, p.Failed)
	assert.Equal(t, 1, p.FailedBatches)
	assert.Zero(t, p.Inserted)
}

func TestRunSnapshotProviderTracksRealScheduledTask(t *testing.T) {
	metrics.StartRun("manual", time.Now(), "provider-pipeline")
	defer metrics.FinishRun(nil, "provider-pipeline")
	source := schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(1)}, nil }}
	_, _, err := runWithConcurrency(context.Background(), []ports.JobSource{source}, domain.ScrapeRequest{Keywords: []string{"go"}, MaxConcurrency: 1}, 1, nil, processConfig{RunID: "provider-pipeline", ClassificationBatchSize: 1, PersistBatchSize: 1})
	require.NoError(t, err)
	providers := metrics.Current().Providers
	require.Len(t, providers, 1)
	assert.Equal(t, "gupy", providers[0].ID)
	assert.Equal(t, 1, providers[0].TasksTotal)
	assert.Equal(t, 1, providers[0].TasksCompleted)
	assert.Equal(t, 1, providers[0].JobsCollected)
	assert.Equal(t, "success", *providers[0].LastTaskStatus)
	assert.Zero(t, providers[0].Active)
}

type observedCatalog struct {
	jobstore.Catalog
	saveErr error
	markErr error
	marks   int
}

func (c *observedCatalog) SaveBatch(_ context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
	if c.saveErr != nil {
		return jobstore.SaveResult{}, c.saveErr
	}
	return jobstore.SaveResult{Inserted: len(jobs), Persisted: jobs}, nil
}
func (c *observedCatalog) MarkIndexed(context.Context, []domain.Job) error {
	c.marks++
	return c.markErr
}

func committedIndexJob() domain.Job {
	j := inScopeJob(1)
	j.ID = jobstore.StableID(&j)
	j.CatalogRevision = 1
	j.CatalogExpiresAt = time.Now().Add(time.Hour)
	j.Classification = &domain.Classification{PrimaryFamily: "backend", InScope: true}
	return j
}

func captureIndexLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })
	return &output
}

func lastIndexLog(t *testing.T, output *bytes.Buffer) map[string]any {
	t.Helper()
	var result map[string]any
	for _, line := range strings.Split(strings.TrimSpace(output.String()), "\n") {
		var record map[string]any
		require.NoError(t, json.Unmarshal([]byte(line), &record))
		if record["msg"] == "scraper stage batch" && record["stage"] == "index" {
			result = record
		}
	}
	require.NotNil(t, result)
	return result
}

func TestDurableLogSeparatesApplyAndCheckpoint(t *testing.T) {
	for _, checkpointErr := range []error{nil, errors.New("checkpoint failure")} {
		t.Run(metrics.BatchStatus(checkpointErr), func(t *testing.T) {
			output := captureIndexLogs(t)
			mr := miniredis.RunT(t)
			rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
			t.Cleanup(func() { rdb.Close() })
			catalog := &observedCatalog{markErr: checkpointErr}
			cfg := processConfig{Store: jobstore.NewDurable(rdb, catalog), RDB: rdb, Keywords: []string{"go"}}
			stats := ProcessStats{}
			err := indexPersistedChunk(context.Background(), cfg, 1, []domain.Job{committedIndexJob()}, &stats)
			require.ErrorIs(t, err, checkpointErr)
			record := lastIndexLog(t, output)
			require.NotContains(t, record, "commands")
			require.NotContains(t, record, "indexed")
			require.Equal(t, "durable", record["index_path"])
			require.Equal(t, true, record["result_confirmed"])
			require.Equal(t, float64(1), record["full_applied"])
			require.Equal(t, metrics.BatchStatus(checkpointErr), record["checkpoint_status"])
			require.Equal(t, false, record["content_change_detection_available"])
			require.Equal(t, 1, catalog.marks)
			if checkpointErr == nil {
				require.NoError(t, indexPersistedChunk(context.Background(), cfg, 2, []domain.Job{committedIndexJob()}, &stats))
				record = lastIndexLog(t, output)
				require.Equal(t, float64(0), record["full_applied"])
				require.Equal(t, float64(1), record["skipped"])
				require.Equal(t, 2, stats.Indexed) // Compatibility: successful inputs, not mutations.
			}
		})
	}
}

func TestIndexInFlightSurvivesEmptyBuffer(t *testing.T) {
	for _, terminalErr := range []error{nil, errors.New("index failure"), context.Canceled} {
		t.Run(metrics.BatchStatus(terminalErr), func(t *testing.T) {
			entered, release, done := make(chan struct{}), make(chan struct{}), make(chan error, 1)
			var releaseOnce sync.Once
			joined := false
			t.Cleanup(func() {
				releaseOnce.Do(func() { close(release) })
				if !joined {
					select {
					case <-done:
					case <-time.After(5 * time.Second):
						t.Error("index goroutine did not exit")
					}
				}
			})
			cfg := processConfig{ClassificationBatchSize: 1, PersistBatchSize: 1, IndexBatchSize: 1,
				Index: func(context.Context, []domain.Job) error { close(entered); <-release; return terminalErr }}
			go func() {
				_, _, err := processIncomingJobs(context.Background(), feedJobs(inScopeJob(1)), cfg)
				done <- err
			}()
			select {
			case <-entered:
			case <-time.After(5 * time.Second):
				t.Fatal("index not entered")
			}
			q := metrics.Current().Queues["indexing"]
			require.Equal(t, 0, q.Depth)
			require.Equal(t, 1, q.InFlight)
			releaseOnce.Do(func() { close(release) })
			gotErr := <-done
			joined = true
			require.ErrorIs(t, gotErr, terminalErr)
			q = metrics.Current().Queues["indexing"]
			require.Zero(t, q.InFlight)
			metrics.ClearQueues()
		})
	}
}

type lostReplyHook struct {
	redis.Hook
	lost bool
}

func (h *lostReplyHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h *lostReplyHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (h *lostReplyHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		err := next(ctx, cmd)
		if err == nil && cmd.Name() == "eval" && !h.lost {
			h.lost = true
			return errors.New("network lost reply")
		}
		return err
	}
}

func TestRetryLogsUnconfirmedAttemptAndIdempotentSkip(t *testing.T) {
	output := captureIndexLogs(t)
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	rdb.AddHook(&lostReplyHook{})
	catalog := &observedCatalog{}
	cfg := processConfig{Store: jobstore.NewDurable(rdb, catalog), RDB: rdb}
	before := testutil.ToFloat64(metrics.IndexRetries.WithLabelValues("network"))
	stats := ProcessStats{}
	require.NoError(t, indexPersistedChunk(context.Background(), cfg, 1, []domain.Job{committedIndexJob()}, &stats))
	record := lastIndexLog(t, output)
	require.Equal(t, float64(2), record["attempts"])
	require.Equal(t, float64(1), record["retries"])
	require.Equal(t, true, record["prior_attempt_unconfirmed"])
	require.Equal(t, float64(0), record["full_applied"])
	require.Equal(t, float64(1), record["skipped"])
	require.Equal(t, before+1, testutil.ToFloat64(metrics.IndexRetries.WithLabelValues("network")))
	require.Equal(t, 1, catalog.marks)
}

func TestFailedPersistDoesNotReportCommittedJobs(t *testing.T) {
	before := testutil.ToFloat64(metrics.CatalogCommittedJobs.WithLabelValues("created"))
	catalog := &observedCatalog{saveErr: errors.New("invalid commit")}
	cfg := processConfig{Store: jobstore.NewDurable(nil, catalog), PersistBatchSize: 1}
	stats := ProcessStats{}
	_, _, _, err := persistJobs(context.Background(), cfg, 1, []domain.Job{committedIndexJob()}, &stats)
	require.Error(t, err)
	require.Equal(t, before, testutil.ToFloat64(metrics.CatalogCommittedJobs.WithLabelValues("created")))
	require.Zero(t, catalog.marks)
}
