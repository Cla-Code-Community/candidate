package pipeline

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

func selectionSources() ([]ports.JobSource, []*atomic.Int32) {
	ids := []ports.ProviderID{ports.ProviderLinkedIn, ports.ProviderAdzuna, ports.ProviderGupy,
		ports.ProviderInHire, ports.ProviderGreenhouse, ports.ProviderLever, ports.ProviderJooble, ports.ProviderTheMuse}
	sources := make([]ports.JobSource, 0, len(ids))
	calls := make([]*atomic.Int32, 0, len(ids))
	for _, id := range ids {
		count := new(atomic.Int32)
		calls = append(calls, count)
		sources = append(sources, schedulerTestAdapter{provider: id, search: func(context.Context, string) ([]domain.Job, error) {
			count.Add(1)
			return nil, nil
		}})
	}
	return sources, calls
}

func TestProviderSelectionRunsEachProviderInIsolation(t *testing.T) {
	sources, _ := selectionSources()
	for i, source := range sources {
		t.Run(string(ports.CapabilitiesOf(source).Provider), func(t *testing.T) {
			adapters, calls := selectionSources()
			_, err := Run(context.Background(), adapters, domain.ScrapeRequest{
				Keywords: []string{"go"}, Sources: []string{string(ports.CapabilitiesOf(source).Provider)}, MaxConcurrency: 4,
			})
			require.NoError(t, err)
			for j, count := range calls {
				want := int32(0)
				if i == j {
					want = 1
				}
				require.Equal(t, want, count.Load())
			}
		})
	}
}

func TestProviderSelectionWithoutSourcesPreservesAllAdapters(t *testing.T) {
	for _, requested := range [][]string{nil, {}} {
		sources, calls := selectionSources()
		_, err := Run(context.Background(), sources, domain.ScrapeRequest{Keywords: []string{"go"}, Sources: requested, MaxConcurrency: 4})
		require.NoError(t, err)
		for _, count := range calls {
			require.EqualValues(t, 1, count.Load())
		}
	}
}

func TestProviderSelectionRejectsUnknownEmptyAndUnconfiguredBeforeExecution(t *testing.T) {
	for _, requested := range [][]string{{"invalid"}, {""}, {" "}, {"linkedin", "invalid"}, {"gupy"}} {
		sources, calls := selectionSources()
		_, _, err := ScrapeAllSources(context.Background(), SearchConfig{Keywords: []string{"go"}, Sources: requested, MaxConcurrency: 4}, sources[:1], nil)
		require.ErrorIs(t, err, ErrInvalidProviderSelection)
		for _, count := range calls {
			require.Zero(t, count.Load())
		}
	}
}

func TestProviderSelectionUsesCapabilitiesAndKeepsAllProviderInstances(t *testing.T) {
	sources := []ports.JobSource{
		schedulerTestAdapter{name: "company-one", provider: ports.ProviderGreenhouse},
		schedulerTestAdapter{name: "linkedin", provider: ports.ProviderGupy},
		schedulerTestAdapter{name: "company-two", provider: ports.ProviderGreenhouse},
	}
	selected, err := selectProviders(sources, []string{" GreenHouse ", "greenhouse"})
	require.NoError(t, err)
	require.Equal(t, []ports.JobSource{sources[0], sources[2]}, selected)
	_, err = selectProviders(sources, []string{"linkedin"})
	require.ErrorIs(t, err, ErrInvalidProviderSelection)
	selected, err = selectProviders(sources, []string{"gupy", "greenhouse"})
	require.NoError(t, err)
	require.Equal(t, sources, selected)
}

func TestProviderSelectionPrecedesCacheAndCadence(t *testing.T) {
	manager, client, _ := newSearchLockManager(t)
	sources, calls := selectionSources()
	c := cache.NewMemoryCache()
	cfg := SearchConfig{Keywords: []string{"go"}, Sources: []string{"gupy"}, MaxConcurrency: 4}
	require.NoError(t, c.Set(context.Background(), BuildCacheKey(cfg), SearchResult{}, time.Minute))
	_, err := SearchJobs(context.Background(), c, cfg, sources[:1], time.Minute, client, manager, "public_endpoint")
	require.ErrorIs(t, err, ErrInvalidProviderSelection)
	cfg.Sources = []string{"linkedin"}
	_, _, err = ScrapeAllSources(context.Background(), cfg, sources, client)
	require.NoError(t, err)
	require.EqualValues(t, 1, calls[0].Load())
	for _, count := range calls[1:] {
		require.Zero(t, count.Load())
	}
	require.Zero(t, client.Exists(context.Background(), joobleRunGateKey).Val())
}

func TestProviderSelectionPreservesSharedRunLock(t *testing.T) {
	manager, client, _ := newSearchLockManager(t)
	sources, calls := selectionSources()
	held, err := manager.Acquire(context.Background(), "cron")
	require.NoError(t, err)
	t.Cleanup(func() { _ = held.Release(context.Background()) })
	_, err = SearchJobs(context.Background(), cache.NewMemoryCache(), SearchConfig{
		Keywords: []string{"go"}, Sources: []string{"linkedin"}, MaxConcurrency: 4,
	}, sources, time.Minute, client, manager, "public_endpoint")
	require.ErrorIs(t, err, runlock.ErrAlreadyHeld)
	for _, count := range calls {
		require.Zero(t, count.Load())
	}
}

func TestProviderSelectionPreservesJoobleCadence(t *testing.T) {
	_, client, _ := newSearchLockManager(t)
	sources, calls := selectionSources()
	cfg := SearchConfig{Keywords: []string{"go"}, Sources: []string{"jooble"}, MaxConcurrency: 4}
	for range 2 {
		_, _, err := ScrapeAllSources(context.Background(), cfg, sources, client)
		require.NoError(t, err)
	}
	require.EqualValues(t, 1, calls[6].Load())
	for i, count := range calls {
		if i != 6 {
			require.Zero(t, count.Load())
		}
	}
}

func TestProviderSelectionSeparatesLegacyCacheResults(t *testing.T) {
	cfg := SearchConfig{Keywords: []string{"go"}, MaxConcurrency: 4}
	require.Contains(t, BuildCacheKey(cfg), "jobs:")
	require.NotContains(t, BuildCacheKey(cfg), "providers:v1")
	cfg.Sources = []string{"linkedin"}
	require.Contains(t, BuildCacheKey(cfg), "jobs:providers:v1:")
}
