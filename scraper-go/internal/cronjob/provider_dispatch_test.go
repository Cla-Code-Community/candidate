package cronjob

import (
	"context"
	"errors"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

type dispatchSource struct {
	err      error
	provider ports.ProviderID
	name     string
	calls    *atomic.Int32
	fail     *atomic.Bool
}

func (s dispatchSource) SourceName() string { return s.name }
func (s dispatchSource) Capabilities() ports.SourceCapabilities {
	return ports.SourceCapabilities{Provider: s.provider, Mode: ports.DiscoveryKeyword}
}
func (s dispatchSource) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	if s.calls != nil {
		s.calls.Add(1)
	}
	if s.err != nil {
		return nil, s.err
	}
	if s.fail != nil && s.fail.Load() {
		return nil, errors.New("provider unavailable")
	}
	return nil, nil
}

func runOneProvider(t *testing.T, s *Scheduler, provider string) {
	t.Helper()
	previous := s.LastRun()
	previousID := ""
	if previous != nil {
		previousID = previous.RunID
	}
	require.NoError(t, s.RunProvidersNow(context.Background(), []string{provider}))
	require.Eventually(t, func() bool { r := s.LastRun(); return r != nil && r.RunID != previousID }, time.Second, time.Millisecond)
}

func TestManualProviderDispatchIsIsolatedAndValidated(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var linkedin, gupy atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &linkedin}, dispatchSource{provider: ports.ProviderGupy, calls: &gupy}}
	runOneProvider(t, s, "linkedin")
	require.EqualValues(t, 1, linkedin.Load())
	require.Zero(t, gupy.Load())
	require.Error(t, s.RunProvidersNow(context.Background(), []string{"invalid"}))
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}

func TestProviderWindowClaimSurvivesRestartAndWaitsForGlobalLock(t *testing.T) {
	s, _, _ := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	s.cfg.ProviderWindows = []config.ProviderWindow{{Provider: ports.ProviderLinkedIn, Start: 0, End: 1440}}
	now := time.Now().UTC()
	held, err := s.runLock.Acquire(context.Background(), "public_endpoint")
	require.NoError(t, err)
	require.NoError(t, s.dispatchProviderWindow(context.Background(), now))
	require.Zero(t, calls.Load())
	require.NoError(t, held.Release(context.Background()))
	require.NoError(t, s.dispatchProviderWindow(context.Background(), now))
	require.EqualValues(t, 1, calls.Load())
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, s.rdb, s.runLock)
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now))
	require.EqualValues(t, 1, calls.Load())
	_, end := windowBounds(now, config.ProviderWindow{Start: 0, End: 1440})
	require.Equal(t, time.UTC, end.Location())
}

func TestGreenhouseBatchIsBoundedAndCheckpointIsFenced(t *testing.T) {
	s, _, _ := newConcurrentTestScheduler(t)
	s.adapterList = nil
	for i := 0; i < 1005; i++ {
		s.adapterList = append(s.adapterList, dispatchSource{provider: ports.ProviderGreenhouse, name: fmt.Sprintf("board-%04d", i)})
	}
	batch, commit, err := s.providerBatch(context.Background(), []string{"greenhouse"})
	require.NoError(t, err)
	require.Len(t, batch, 1000)
	lease, err := s.runLock.Acquire(context.Background(), "admin_manual")
	require.NoError(t, err)
	require.NoError(t, commit(lease))
	require.NoError(t, lease.Release(context.Background()))
	batch, commit, err = s.providerBatch(context.Background(), []string{"greenhouse"})
	require.NoError(t, err)
	require.Len(t, batch, 5)
	require.Equal(t, "board-1000", batch[0].SourceName())
	before := s.rdb.Get(context.Background(), greenhouseCheckpointKey).Val()
	newLease, err := s.runLock.Acquire(context.Background(), "admin_manual")
	require.NoError(t, err)
	require.NoError(t, s.rdb.Set(context.Background(), runlock.LockKey, "replacement-owner", time.Minute).Err())
	require.ErrorIs(t, commit(newLease), runlock.ErrLost)
	_ = newLease.Release(context.Background())
	require.Equal(t, before, s.rdb.Get(context.Background(), greenhouseCheckpointKey).Val())
	s.adapterList = append(s.adapterList, dispatchSource{provider: ports.ProviderGreenhouse, name: "board-new"})
	batch, _, err = s.providerBatch(context.Background(), []string{"greenhouse"})
	require.NoError(t, err)
	require.Equal(t, "board-0000", batch[0].SourceName())
}

func TestGreenhouseCheckpointOnlyAdvancesAfterSuccessfulProcessing(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	s.cfg.GreenhouseBatchSize = 1
	var fail atomic.Bool
	fail.Store(true)
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderGreenhouse, name: "a", fail: &fail}, dispatchSource{provider: ports.ProviderGreenhouse, name: "b"}}
	runOneProvider(t, s, "greenhouse")
	require.NotEqual(t, "success", s.LastRun().Status)
	require.Zero(t, client.Exists(context.Background(), greenhouseCheckpointKey).Val())
	fail.Store(false)
	runOneProvider(t, s, "greenhouse")
	require.Equal(t, "success", s.LastRun().Status)
	batch, _, err := s.providerBatch(context.Background(), []string{"greenhouse"})
	require.NoError(t, err)
	require.Len(t, batch, 1)
	require.Equal(t, "b", batch[0].SourceName())
}
