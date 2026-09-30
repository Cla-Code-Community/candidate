package pipeline_test

import (
	"context"
	"sync/atomic"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type pipelineCountHook struct {
	redis.Hook
	count atomic.Int32
}

func (h *pipelineCountHook) DialHook(next redis.DialHook) redis.DialHook {
	return next
}

func (h *pipelineCountHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return next
}

func (h *pipelineCountHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		h.count.Add(1)
		return next(ctx, cmds)
	}
}

func classifiedJob(i int) domain.Job {
	job := domain.Job{
		Title:          "Backend Engineer",
		Company:        "Acme",
		Location:       "Brasil",
		Description:    "Golang go APIs microservices",
		Classification: &domain.Classification{PrimaryFamily: "backend", InScope: true},
	}
	job.Company = job.Company + string(rune('A'+i))
	job.ID = jobstore.StableID(&job)
	return job
}

func TestIndexJobsInValkeyBatchedRespectsBatchSize(t *testing.T) {
	rdb, _ := newTestRedis(t)
	hook := &pipelineCountHook{}
	rdb.AddHook(hook)

	jobs := []domain.Job{classifiedJob(0), classifiedJob(1), classifiedJob(2), classifiedJob(3), classifiedJob(4)}
	commands, err := pipeline.IndexJobsInValkeyBatched(context.Background(), rdb, jobs, []string{"go"}, 2)
	require.NoError(t, err)
	assert.Greater(t, commands, 0)

	rdbSingle, _ := newTestRedis(t)
	singleHook := &pipelineCountHook{}
	rdbSingle.AddHook(singleHook)
	_, err = pipeline.IndexJobsInValkeyBatched(context.Background(), rdbSingle, jobs, []string{"go"}, 1)
	require.NoError(t, err)
	assert.Greater(t, singleHook.count.Load(), hook.count.Load())
}

func TestIndexJobsInValkeyCancelBeforeNextBatch(t *testing.T) {
	rdb, _ := newTestRedis(t)
	jobs := []domain.Job{classifiedJob(0), classifiedJob(1), classifiedJob(2)}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := pipeline.IndexJobsInValkeyBatched(ctx, rdb, jobs, []string{"go"}, 1)
	require.Error(t, err)
}

func TestReindexPersistedJobsIsIdempotent(t *testing.T) {
	rdb, _ := newTestRedis(t)
	store := jobstore.New(rdb)
	ctx := context.Background()
	job := classifiedJob(0)
	saved, err := store.SaveBatch(ctx, []domain.Job{job})
	require.NoError(t, err)
	require.Len(t, saved.Persisted, 1)

	require.NoError(t, pipeline.ReindexPersistedJobs(ctx, store, rdb, []string{saved.Persisted[0].ID}, []string{"go"}, 10))
	require.NoError(t, pipeline.ReindexPersistedJobs(ctx, store, rdb, []string{saved.Persisted[0].ID}, []string{"go"}, 10))

	members, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.Equal(t, []string{saved.Persisted[0].ID}, members)
}

func TestIndexJobsInValkeyReplacesMembersWithCurrentExecution(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()
	first := []domain.Job{classifiedJob(0)}
	second := []domain.Job{classifiedJob(1)}

	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, first, []string{"go"}))
	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, second, []string{"go"}))

	members, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.Equal(t, []string{classifiedJob(1).ID}, members)
	nextExists, err := rdb.Exists(ctx, "scraper:jobs:keyword:go:next").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), nextExists)
}

func TestIndexJobsInValkeyRemovesStaleKeywordMembers(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()
	job := classifiedJob(0)
	job.Description = "Golang go python APIs microservices"
	keywords := []string{"go", "python"}

	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, []domain.Job{job}, keywords))
	pythonMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:python").Result()
	require.NoError(t, err)
	assert.Equal(t, []string{job.ID}, pythonMembers)

	job.Description = "Golang go APIs microservices postgresql redis kafka"
	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, []domain.Job{job}, keywords))

	goMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.Equal(t, []string{job.ID}, goMembers)
	pythonAfter, err := rdb.SMembers(ctx, "scraper:jobs:keyword:python").Result()
	require.NoError(t, err)
	assert.NotContains(t, pythonAfter, job.ID)
}

func TestIndexJobsInValkeyRemovesStaleClassificationMembers(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()
	job := classifiedJob(0)
	job.Classification = &domain.Classification{
		PrimaryFamily: "backend",
		Technologies:  []string{"go"},
		Seniority:     "senior",
		InScope:       true,
	}

	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, []domain.Job{job}, []string{"go"}))
	for _, key := range []string{
		"scraper:jobs:family:backend",
		"scraper:jobs:technology:go",
		"scraper:jobs:seniority:senior",
	} {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.Contains(t, members, job.ID, key)
	}

	job.Classification = &domain.Classification{
		PrimaryFamily: "frontend",
		Technologies:  []string{"react"},
		Seniority:     "junior",
		InScope:       true,
	}
	require.NoError(t, pipeline.IndexJobsInValkey(ctx, rdb, []domain.Job{job}, []string{"go"}))

	for _, key := range []string{
		"scraper:jobs:family:backend",
		"scraper:jobs:technology:go",
		"scraper:jobs:seniority:senior",
	} {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.NotContains(t, members, job.ID, key)
	}
	for _, key := range []string{
		"scraper:jobs:family:frontend",
		"scraper:jobs:technology:react",
		"scraper:jobs:seniority:junior",
	} {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.Contains(t, members, job.ID, key)
	}
}
