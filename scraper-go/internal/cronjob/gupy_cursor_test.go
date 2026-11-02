package cronjob

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

func TestGupyCursorSurvivesRestartAndFencesWrites(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	ctx := context.Background()
	lease, err := s.runLock.Acquire(ctx, "cron")
	require.NoError(t, err)
	cursor := &gupyCursor{s, lease}
	position, err := cursor.Load(ctx, "manifest", 200)
	require.NoError(t, err)
	require.Zero(t, position)
	require.NoError(t, cursor.Advance(ctx, "manifest", 200, 0))
	require.NoError(t, lease.Release(ctx))
	lease, err = s.runLock.Acquire(ctx, "cron")
	require.NoError(t, err)
	defer lease.Release(ctx)
	restarted := &gupyCursor{New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock), lease}
	position, err = restarted.Load(ctx, "manifest", 200)
	require.NoError(t, err)
	require.Equal(t, 1, position)
	_, err = restarted.Load(ctx, "changed", 200)
	require.Error(t, err)
	require.NoError(t, client.Set(ctx, runlock.LockKey, "new-owner", time.Minute).Err())
	require.ErrorIs(t, restarted.Advance(ctx, "manifest", 200, 1), runlock.ErrLost)
	position, err = restarted.Load(ctx, "manifest", 200)
	require.NoError(t, err)
	require.Equal(t, 1, position)
}

type checkpointGupySource struct{ t *testing.T }

func (s checkpointGupySource) SourceName() string { return "Gupy" }
func (s checkpointGupySource) Capabilities() ports.SourceCapabilities {
	return ports.SourceCapabilities{Provider: ports.ProviderGupy, Mode: ports.DiscoveryBatch}
}
func (s checkpointGupySource) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	return nil, errors.New("expected batch")
}
func (s checkpointGupySource) SearchBatch(ctx context.Context, _ []string, req domain.ScrapeRequest) ([]domain.Job, error) {
	require.True(s.t, req.GupyWindow)
	require.NotNil(s.t, req.QueryCursor)
	require.NotEmpty(s.t, req.WindowID)
	offset, err := req.QueryCursor.Load(ctx, "manifest", 200)
	if err != nil {
		return nil, err
	}
	if err = req.QueryCursor.Advance(ctx, "manifest", 200, offset); err != nil {
		return nil, err
	}
	job := schedulerTestJob()
	job.Source = "gupy"
	return []domain.Job{job}, errors.New("query truncated")
}
func TestGupyWindowWiresCursorAndPersistsPartialJobs(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	s.adapterList = []ports.JobSource{checkpointGupySource{t}}
	windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
	require.NoError(t, err)
	s.cfg.ProviderWindows = windows
	day := time.Now().Add(24 * time.Hour)
	for _, index := range []int{1, 7} {
		start, _ := windowBounds(day, windows[index])
		require.Error(t, s.dispatchProviderWindow(context.Background(), start))
		require.Equal(t, "partial", s.LastRun().Status)
		require.Positive(t, s.LastRun().JobsSaved)
		require.Positive(t, s.LastRun().JobsIndexed)
	}
	var state gupyCursorState
	raw, err := client.Get(context.Background(), gupyCursorKey).Bytes()
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(raw, &state))
	require.Equal(t, 2, state.Offset)
}
