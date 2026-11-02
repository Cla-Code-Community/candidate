package cronjob

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

func TestProviderWindowLocalDatesAndNextStart(t *testing.T) {
	w := config.ProviderWindow{Provider: ports.ProviderGupy, ID: "gupy-night", Start: 23 * 60, End: 1440, Timezone: config.ProviderScheduleTimezone}
	now := time.Date(2026, 11, 3, 2, 30, 0, 0, time.UTC)
	start, end := windowBounds(now, w)
	require.Equal(t, "2026-11-02", start.Format("2006-01-02"))
	require.Equal(t, time.Date(2026, 11, 3, 2, 0, 0, 0, time.UTC), start.UTC())
	require.Equal(t, time.Date(2026, 11, 3, 3, 0, 0, 0, time.UTC), end.UTC())
	require.Equal(t, time.Date(2026, 11, 4, 2, 0, 0, 0, time.UTC), nextWindowStart(now, w).UTC())
	require.Contains(t, windowOccurrenceKey(start, w), "2026-11-02:gupy-night")
	w.Start, w.End = 0, 60
	start, _ = windowBounds(end, w)
	require.Equal(t, "2026-11-03", start.Format("2006-01-02"))
	require.Equal(t, end.UTC(), start.UTC())
}

func TestProviderWindowUsesCivilDayAcrossTimezoneChanges(t *testing.T) {
	w := config.ProviderWindow{Start: 0, End: 1440, Timezone: "America/New_York"}
	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	start, end := windowBounds(now, w)
	require.Equal(t, 25*time.Hour, end.Sub(start))
	require.Equal(t, end, nextWindowStart(now, w))
}

func TestProviderWindowOccurrenceIsolationAndRestart(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var linkedin, gupy atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &linkedin}, dispatchSource{provider: ports.ProviderGupy, calls: &gupy}}
	// Use a future hour so the real lease deadline is valid even when tests
	// start in the last seconds of a civil window.
	now := time.Now().UTC().Truncate(time.Hour).Add(time.Hour)
	local := now.In(mustProviderLocation(t))
	hour := local.Hour()
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: hour * 60, End: (hour + 1) * 60, Timezone: config.ProviderScheduleTimezone}
	s.cfg.ProviderWindows = []config.ProviderWindow{w}
	require.NoError(t, s.dispatchProviderWindow(context.Background(), now))
	require.EqualValues(t, 1, linkedin.Load())
	require.Zero(t, gupy.Load())
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now))
	require.EqualValues(t, 1, linkedin.Load())
	// A second same-provider window has its own daily occurrence.
	w.ID = "linkedin-2"
	w.Start, w.End = ((hour+1)%24)*60, ((hour+1)%24+1)*60
	restarted.cfg.ProviderWindows = []config.ProviderWindow{w}
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now.Add(time.Hour)))
	require.EqualValues(t, 2, linkedin.Load())
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now.Add(time.Hour)))
	require.EqualValues(t, 2, linkedin.Load())
	// The following local day permits a new occurrence of that same window.
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now.Add(25*time.Hour)))
	require.EqualValues(t, 3, linkedin.Load())
	require.Zero(t, gupy.Load())
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}

func mustProviderLocation(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(config.ProviderScheduleTimezone)
	require.NoError(t, err)
	return loc
}

func TestProviderWindowLegacyOccurrenceKeyIsPreserved(t *testing.T) {
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, Start: 60, End: 120}
	start, _ := windowBounds(time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC), w)
	require.Equal(t, "scraper:window:2026-11-02:linkedin:60", windowOccurrenceKey(start, w))
}

func TestProviderScheduleDispatches21OccurrencesWithoutRepeatingAfterRestart(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
	require.NoError(t, err)
	s.cfg.ProviderWindows = windows
	s.adapterList = nil
	calls := map[ports.ProviderID]*atomic.Int32{}
	for _, w := range windows {
		if calls[w.Provider] == nil {
			calls[w.Provider] = &atomic.Int32{}
			s.adapterList = append(s.adapterList, dispatchSource{provider: w.Provider, name: string(w.Provider), calls: calls[w.Provider]})
		}
	}
	day := time.Now().In(mustProviderLocation(t)).AddDate(0, 0, 1)
	for _, w := range windows {
		start, _ := windowBounds(day, w)
		require.NoError(t, s.dispatchProviderWindow(context.Background(), start), w.WindowID())
	}
	require.Len(t, client.Keys(context.Background(), "scraper:window:*").Val(), 21)
	expected := map[ports.ProviderID]int32{}
	for _, w := range windows {
		expected[w.Provider]++
	}
	for provider, count := range expected {
		require.Equal(t, count, calls[provider].Load(), provider)
	}
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
	for _, w := range windows {
		start, _ := windowBounds(day, w)
		require.NoError(t, restarted.dispatchProviderWindow(context.Background(), start))
	}
	for provider, count := range expected {
		require.Equal(t, count, calls[provider].Load(), provider)
	}
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}

func TestProviderWindowInterruptedClaimAndBusyLockDoNotStartProviders(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 0, End: 1440, Timezone: config.ProviderScheduleTimezone}
	s.cfg.ProviderWindows = []config.ProviderWindow{w}
	now := time.Now().UTC().Add(time.Hour)
	held, err := s.runLock.Acquire(context.Background(), "admin_manual")
	require.NoError(t, err)
	require.NoError(t, s.dispatchProviderWindow(context.Background(), now))
	require.Zero(t, calls.Load())
	require.Empty(t, client.Keys(context.Background(), "scraper:window:*").Val())
	require.NoError(t, held.Release(context.Background()))
	// Simulate a process that died after claiming but before completing work.
	start, _ := windowBounds(now, w)
	require.NoError(t, client.Set(context.Background(), windowOccurrenceKey(start, w), "interrupted-run", 48*time.Hour).Err())
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), now))
	require.Zero(t, calls.Load())
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}
