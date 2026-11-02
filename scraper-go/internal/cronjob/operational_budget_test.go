package cronjob

import (
	"context"
	"errors"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestGlobalPauseAppliesAfterSuccessFailureAndManualDispatch(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "failure"}[fail], func(t *testing.T) {
			s, _, client := newConcurrentTestScheduler(t)
			s.runLock, _ = runlock.New(runlock.NewValkeyStore(client), runlock.Config{TTL: 2 * time.Second, RenewInterval: 500 * time.Millisecond})
			s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn}}
			if fail {
				s.BeforeRun = func(context.Context) error { return errors.New("preparation failed") }
			}
			started := time.Now()
			runOneProvider(t, s, "linkedin")
			require.Less(t, time.Since(started), time.Second)
			require.NotEmpty(t, client.Get(context.Background(), runlock.NextAllowedKey).Val())
			var pause *runlock.CooldownError
			require.ErrorAs(t, s.RunProvidersNow(context.Background(), []string{"linkedin"}), &pause)
			require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
		})
	}
}

func TestPreparationConsumesCollectionBudgetAndPartialDrainKeepsLock(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	// The existing blocking fake returns a valid job when collection expires.
	s.cfg.ScrapeTimeout = 120 * time.Millisecond
	var preparationDeadline time.Time
	s.BeforeRun = func(ctx context.Context) error {
		preparationDeadline, _ = ctx.Deadline()
		timer := time.NewTimer(70 * time.Millisecond)
		defer timer.Stop()
		select {
		case <-timer.C:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 350*time.Millisecond)
	defer cancel()
	start := time.Now()
	s.runCron(ctx)
	require.Less(t, preparationDeadline.Sub(start), 150*time.Millisecond)
	require.Equal(t, "partial", s.LastRun().Status)
	require.Positive(t, s.LastRun().JobsSaved)
	require.Positive(t, s.LastRun().JobsIndexed)
	require.Less(t, time.Since(start), 350*time.Millisecond)
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}

func TestUnavailableAdmissionDoesNotRetryWhenStorageReturns(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120}
	s.cfg.ProviderWindows = []config.ProviderWindow{w}
	start, _ := windowBounds(time.Now().Add(24*time.Hour), w)
	s.rdb = nil
	require.ErrorIs(t, s.dispatchProviderWindow(context.Background(), start), ErrLockUnavailable)
	s.rdb = client
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(time.Second)))
	require.Zero(t, calls.Load())
	require.Equal(t, "missed:admission_unavailable", client.Get(context.Background(), windowOccurrenceKey(start, w)).Val())
}

func TestFixedWindowToleranceAndMissedOccurrenceNeverCatchUp(t *testing.T) {
	for _, late := range []time.Duration{0, ProviderStartTolerance, ProviderStartTolerance + time.Nanosecond} {
		t.Run(late.String(), func(t *testing.T) {
			s, _, client := newConcurrentTestScheduler(t)
			frozen := time.Now()
			s.admissionClock = func() time.Time { return frozen }
			var calls atomic.Int32
			s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
			w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120, Timezone: config.ProviderScheduleTimezone}
			s.cfg.ProviderWindows = []config.ProviderWindow{w}
			day := time.Now().Add(24 * time.Hour)
			start, _ := windowBounds(day, w)
			require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(-time.Nanosecond)))
			require.Zero(t, calls.Load())
			require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(late)))
			if late <= ProviderStartTolerance {
				require.EqualValues(t, 1, calls.Load())
			} else {
				require.Zero(t, calls.Load())
				require.True(t, strings.HasPrefix(client.Get(context.Background(), windowOccurrenceKey(start, w)).Val(), "missed:"))
			}
			require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(20*time.Minute)))
			if late <= ProviderStartTolerance {
				require.EqualValues(t, 1, calls.Load())
			} else {
				require.Zero(t, calls.Load())
			}
		})
	}
}

func TestBusyWindowIsConsumedAndOnlyReturnsNextDay(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120}
	s.cfg.ProviderWindows = []config.ProviderWindow{w}
	start, _ := windowBounds(time.Now().Add(24*time.Hour), w)
	held, err := s.runLock.Acquire(context.Background(), "admin_manual")
	require.NoError(t, err)
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
	require.NoError(t, held.Release(context.Background()))
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(time.Second)))
	require.Zero(t, calls.Load())
	require.Equal(t, "missed:lock_busy", client.Get(context.Background(), windowOccurrenceKey(start, w)).Val())
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start.AddDate(0, 0, 1)))
	require.EqualValues(t, 1, calls.Load())
}
