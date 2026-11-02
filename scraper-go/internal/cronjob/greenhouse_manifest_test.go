package cronjob

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

type fixedGroupTestSource struct {
	id     string
	search func(context.Context, string) ([]domain.Job, error)
}

func (a fixedGroupTestSource) SourceID() string   { return a.id }
func (a fixedGroupTestSource) SourceName() string { return "same display name for every company" }
func (a fixedGroupTestSource) Capabilities() ports.SourceCapabilities {
	return ports.SourceCapabilities{Provider: ports.ProviderGreenhouse, Mode: ports.DiscoveryKeyword}
}
func (a fixedGroupTestSource) Search(ctx context.Context, _ string, _ domain.ScrapeRequest) ([]domain.Job, error) {
	if a.search != nil {
		return a.search(ctx, a.id)
	}
	return nil, nil
}

func fixedGroupTestManifest(t *testing.T) greenhouseManifest {
	t.Helper()
	m, _, err := parseGreenhouseManifest(greenhouseManifestJSON)
	require.NoError(t, err)
	return m
}
func fixedGroupTestRegistry(t *testing.T, search func(context.Context, string) ([]domain.Job, error)) []ports.JobSource {
	t.Helper()
	m := fixedGroupTestManifest(t)
	var sources []ports.JobSource
	for i := 1; i <= 4; i++ {
		for _, id := range m.Groups[fmt.Sprintf("greenhouse-%d", i)] {
			sources = append(sources, fixedGroupTestSource{id: id, search: search})
		}
	}
	return sources
}

func TestGreenhouseFixedManifestCoversCatalogOnceAndSurvivesReordering(t *testing.T) {
	m := fixedGroupTestManifest(t)
	raw, err := os.ReadFile("../interfaces/greenhouseCompanies.json")
	require.NoError(t, err)
	var catalog []string
	require.NoError(t, json.Unmarshal(raw, &catalog))
	sources := fixedGroupTestRegistry(t, nil)
	seen := map[string]bool{}
	counts := []int{850, 850, 850, 789}
	for i, count := range counts {
		id := fmt.Sprintf("greenhouse-%d", i+1)
		batch, err := m.selectGroup(sources, id)
		require.NoError(t, err)
		require.Len(t, batch, count)
		for _, source := range batch {
			board := source.(ports.StableJobSource).SourceID()
			require.False(t, seen[board], board)
			seen[board] = true
		}
		// New process, reordered adapters and identical display names preserve IDs.
		restarted := fixedGroupTestManifest(t)
		sort.Slice(sources, func(a, b int) bool {
			return sources[a].(ports.StableJobSource).SourceID() > sources[b].(ports.StableJobSource).SourceID()
		})
		other, err := restarted.selectGroup(sources, id)
		require.NoError(t, err)
		require.Equal(t, batch, other)
	}
	require.Len(t, seen, 3339)
	require.Len(t, catalog, len(seen))
	for _, id := range catalog {
		require.True(t, seen[id], id)
	}
}

func TestGreenhouseFixedManifestRejectsCatalogDriftAndInvalidIdentities(t *testing.T) {
	m := fixedGroupTestManifest(t)
	sources := fixedGroupTestRegistry(t, nil)
	for _, changed := range [][]ports.JobSource{
		sources[1:],
		append(append([]ports.JobSource(nil), sources...), fixedGroupTestSource{id: "new-unassigned-company"}),
		append(append([]ports.JobSource(nil), sources...), sources[0]),
		append([]ports.JobSource{dispatchSource{provider: ports.ProviderGreenhouse}}, sources[1:]...),
	} {
		_, err := m.selectGroup(changed, "greenhouse-1")
		require.Error(t, err)
	}
	_, err := m.selectGroup(sources, "greenhouse-5")
	require.Error(t, err)
	for _, raw := range []string{
		`{}`, `{"version":"greenhouse-v1","groups":{"greenhouse-1":["a"],"greenhouse-2":["a"],"greenhouse-3":[],"greenhouse-4":[]}}`,
		`{"version":"greenhouse-v1","groups":{"greenhouse-1":[" "],"greenhouse-2":[],"greenhouse-3":[],"greenhouse-4":[]}}`,
	} {
		_, _, err := parseGreenhouseManifest([]byte(raw))
		require.Error(t, err)
	}
	// An explicitly reviewed new manifest can have another catalog size.
	updated := greenhouseManifest{Version: "greenhouse-v2", Groups: map[string][]string{"greenhouse-1": {"a"}, "greenhouse-2": {"b"}, "greenhouse-3": {"c"}, "greenhouse-4": {"d", "e"}}}
	raw, err := json.Marshal(updated)
	require.NoError(t, err)
	parsed, _, err := parseGreenhouseManifest(raw)
	require.NoError(t, err)
	var next []ports.JobSource
	for _, id := range []string{"a", "b", "c", "d", "e"} {
		next = append(next, fixedGroupTestSource{id: id})
	}
	batch, err := parsed.selectGroup(next, "greenhouse-4")
	require.NoError(t, err)
	require.Len(t, batch, 2)
}

func TestGreenhouseFixedManifestPinIsImmutableAndFenced(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	s.adapterList = fixedGroupTestRegistry(t, nil)
	lease, err := s.runLock.Acquire(context.Background(), "cron")
	require.NoError(t, err)
	t.Cleanup(func() { _ = lease.Release(context.Background()) })
	batch, err := s.greenhouseFixedBatch(context.Background(), lease, "greenhouse-1")
	require.NoError(t, err)
	require.Len(t, batch, 850)
	m, digest, err := parseGreenhouseManifest(greenhouseManifestJSON)
	require.NoError(t, err)
	key := "scraper:provider:greenhouse:manifest:" + m.Version
	require.Equal(t, digest, client.Get(context.Background(), key).Val())
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
	_, err = restarted.greenhouseFixedBatch(context.Background(), lease, "greenhouse-2")
	require.NoError(t, err)
	require.NoError(t, client.Set(context.Background(), key, "different-content-same-version", 0).Err())
	_, err = s.greenhouseFixedBatch(context.Background(), lease, "greenhouse-1")
	require.ErrorContains(t, err, "version migration")
	require.NoError(t, client.Set(context.Background(), key, digest, 0).Err())
	require.NoError(t, client.Set(context.Background(), runlock.LockKey, "replacement-owner", time.Minute).Err())
	_, err = s.greenhouseFixedBatch(context.Background(), lease, "greenhouse-1")
	require.ErrorIs(t, err, runlock.ErrLost)
	require.Equal(t, digest, client.Get(context.Background(), key).Val())
}

func TestGreenhouseFixedGroupsPreservePartialJobsAndNeverTransferFailures(t *testing.T) {
	for _, failure := range []string{"adapter-error", "timeout"} {
		t.Run(failure, func(t *testing.T) {
			s, _, client := newConcurrentTestScheduler(t)
			m := fixedGroupTestManifest(t)
			first := m.Groups["greenhouse-1"][0]
			last := m.Groups["greenhouse-1"][849]
			visits := map[string]int{}
			var mu sync.Mutex
			var failing atomic.Bool
			failing.Store(true)
			s.cfg.ScrapeTimeout = 300 * time.Millisecond
			s.cfg.ClassificationBatchSize = 1
			s.cfg.PersistBatchSize = 1
			s.cfg.IndexBatchSize = 1
			s.adapterList = fixedGroupTestRegistry(t, func(ctx context.Context, id string) ([]domain.Job, error) {
				mu.Lock()
				visits[id]++
				mu.Unlock()
				if id != first {
					return nil, nil
				}
				job := schedulerTestJob()
				job.Source = "greenhouse"
				if !failing.Load() {
					return []domain.Job{job}, nil
				}
				if failure == "timeout" {
					<-ctx.Done()
					return []domain.Job{job}, ctx.Err()
				}
				return []domain.Job{job}, errors.New("board unavailable")
			})
			windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
			require.NoError(t, err)
			s.cfg.ProviderWindows = windows
			require.NoError(t, client.Set(context.Background(), greenhouseCheckpointKey, "legacy-state-must-not-change", 0).Err())
			day := time.Now().In(mustProviderLocation(t)).AddDate(0, 0, 1)
			start, _ := windowBounds(day, windows[0])
			require.Error(t, s.dispatchProviderWindow(context.Background(), start))
			require.Equal(t, "partial", s.LastRun().Status)
			require.Positive(t, s.LastRun().JobsSaved)
			require.Positive(t, s.LastRun().JobsIndexed)
			mu.Lock()
			before := visits[first]
			if failure == "timeout" {
				require.Zero(t, visits[last], "unstarted board must remain in its own group")
			}
			mu.Unlock()
			require.Equal(t, 1, before)
			// The consumed occurrence is not replayed, including after restart.
			restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
			require.NoError(t, restarted.dispatchProviderWindow(context.Background(), start))
			second := windows[6] // greenhouse-2 at 06:00 local.
			require.Equal(t, "greenhouse-2", second.WindowID())
			secondStart, _ := windowBounds(day, second)
			require.NoError(t, restarted.dispatchProviderWindow(context.Background(), secondStart))
			mu.Lock()
			require.Equal(t, 1, visits[first])
			for _, id := range m.Groups["greenhouse-2"] {
				require.Equal(t, 1, visits[id], id)
			}
			for _, id := range m.Groups["greenhouse-3"] {
				require.Zero(t, visits[id], id)
			}
			if failure == "timeout" {
				require.Zero(t, visits[last], "next window must not receive unfinished boards")
			}
			mu.Unlock()
			failing.Store(false)
			require.NoError(t, restarted.dispatchProviderWindow(context.Background(), start.AddDate(0, 0, 1)))
			mu.Lock()
			require.Equal(t, 2, visits[first])
			if failure == "timeout" {
				require.Equal(t, 1, visits[last], "unfinished board returns in the same window on the next day")
			}
			for _, id := range m.Groups["greenhouse-2"] {
				require.Equal(t, 1, visits[id])
			}
			mu.Unlock()
			require.Equal(t, "legacy-state-must-not-change", client.Get(context.Background(), greenhouseCheckpointKey).Val())
			count, err := s.jobStore.Count(context.Background())
			require.NoError(t, err)
			require.Positive(t, count)
			require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
		})
	}
}

func TestGreenhouseFixedPresetKeepsManualAndCustomWindowLegacyBatching(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
	require.NoError(t, err)
	s.cfg.ProviderWindows = windows
	s.cfg.GreenhouseBatchSize = 2
	var calls atomic.Int32
	// Legacy sources intentionally have no stable-identity interface and a
	// different catalog. Manual execution must still use the existing offset.
	s.adapterList = []ports.JobSource{
		dispatchSource{provider: ports.ProviderGreenhouse, name: "a", calls: &calls},
		dispatchSource{provider: ports.ProviderGreenhouse, name: "b", calls: &calls},
		dispatchSource{provider: ports.ProviderGreenhouse, name: "c", calls: &calls},
	}
	runOneProvider(t, s, "greenhouse")
	require.EqualValues(t, 2, calls.Load())
	require.NotEmpty(t, client.Get(context.Background(), greenhouseCheckpointKey).Val())
	custom, err := config.ParseProviderWindowsInTimezone("greenhouse-1@greenhouse=00:00-24:00", config.ProviderScheduleTimezone)
	require.NoError(t, err)
	s.cfg.ProviderWindows = custom
	start, _ := windowBounds(time.Now().UTC().Add(24*time.Hour), custom[0])
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
	require.EqualValues(t, 3, calls.Load())
	require.Empty(t, client.Keys(context.Background(), "scraper:provider:greenhouse:manifest:*").Val())
}
