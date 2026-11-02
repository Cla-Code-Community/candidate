package cronjob

import (
	"context"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

// Advance only after the run ID has been persisted: the global lease is already
// held and all admission coordination has finished. No real waiting is needed.
type admissionLatencyHook struct {
	key     string
	advance func()
}

func (h admissionLatencyHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (h admissionLatencyHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return next
}
func (h admissionLatencyHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		err := next(ctx, cmd)
		args := cmd.Args()
		if err == nil && cmd.Name() == "set" && len(args) > 2 && args[1] == h.key {
			value, _ := args[2].(string)
			if !strings.HasPrefix(value, "admitting:") && !strings.HasPrefix(value, "missed:") {
				h.advance()
			}
		}
		return err
	}
}

func TestProviderAdmissionRechecksClockAfterCoordination(t *testing.T) {
	for _, latency := range []time.Duration{time.Second, 30 * time.Second, 30*time.Second + time.Nanosecond, 31 * time.Second} {
		t.Run(latency.String(), func(t *testing.T) {
			s, _, client := newConcurrentTestScheduler(t)
			var calls atomic.Int32
			s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
			w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120, Timezone: config.ProviderScheduleTimezone}
			s.cfg.ProviderWindows = []config.ProviderWindow{w}
			start, _ := windowBounds(time.Now().AddDate(0, 0, 1), w)
			var elapsed atomic.Int64
			base := time.Now()
			s.admissionClock = func() time.Time { return base.Add(time.Duration(elapsed.Load())) }
			key := windowOccurrenceKey(start, w)
			client.AddHook(admissionLatencyHook{key: key, advance: func() { elapsed.Add(int64(latency)) }})

			require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
			require.Equal(t, int64(latency), elapsed.Load(), "latency must occur after lock acquisition")
			require.Zero(t, client.Exists(context.Background(), runlock.LockKey, runlock.StateKey).Val())
			if latency <= ProviderStartTolerance {
				require.EqualValues(t, 1, calls.Load())
			} else {
				require.Zero(t, calls.Load())
				require.Nil(t, s.LastRun(), "rejected admission is not a provider run")
				require.Equal(t, "missed:admission_late", client.Get(context.Background(), key).Val())
			}
			shutdownCtx, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			require.NoError(t, s.Shutdown(shutdownCtx), "admission must release active execution accounting")
		})
	}
}

func TestLateAdmissionSurvivesRestartAndDoesNotConsumeNextWindow(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120}
	next := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-2", Start: 120, End: 180}
	s.cfg.ProviderWindows = []config.ProviderWindow{w, next}
	start, _ := windowBounds(time.Now().AddDate(0, 0, 1), w)
	var elapsed atomic.Int64
	base := time.Now()
	s.admissionClock = func() time.Time { return base.Add(time.Duration(elapsed.Load())) }
	key := windowOccurrenceKey(start, w)
	client.AddHook(admissionLatencyHook{key: key, advance: func() { elapsed.Add(int64(31 * time.Second)) }})
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
	require.Zero(t, calls.Load())
	require.Equal(t, "missed:admission_late", client.Get(context.Background(), key).Val())

	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, client, s.runLock)
	restarted.admissionClock = func() time.Time { return base }
	// Even a second replica with a clock still inside the tolerance cannot retry.
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), start.Add(time.Second)))
	require.Zero(t, calls.Load())
	nextStart, _ := windowBounds(start, next)
	require.Zero(t, client.Exists(context.Background(), windowOccurrenceKey(nextStart, next)).Val())
	require.NoError(t, restarted.dispatchProviderWindow(context.Background(), nextStart))
	require.EqualValues(t, 1, calls.Load())
	require.Equal(t, "missed:admission_late", client.Get(context.Background(), key).Val())
}

func TestLateAdmissionPreservesGlobalPause(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderLinkedIn, calls: &calls}}
	var err error
	s.runLock, err = runlock.New(runlock.NewValkeyStore(client), runlock.Config{TTL: 2 * time.Second, RenewInterval: 500 * time.Millisecond})
	require.NoError(t, err)
	w := config.ProviderWindow{Provider: ports.ProviderLinkedIn, ID: "linkedin-1", Start: 60, End: 120}
	s.cfg.ProviderWindows = []config.ProviderWindow{w}
	start, _ := windowBounds(time.Now().AddDate(0, 0, 1), w)
	base := time.Now()
	var elapsed atomic.Int64
	s.admissionClock = func() time.Time { return base.Add(time.Duration(elapsed.Load())) }
	client.AddHook(admissionLatencyHook{key: windowOccurrenceKey(start, w), advance: func() { elapsed.Add(int64(31 * time.Second)) }})
	require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
	require.Zero(t, calls.Load())
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey, runlock.StateKey).Val())
	require.NotEmpty(t, client.Get(context.Background(), runlock.NextAllowedKey).Val())
	var pause *runlock.CooldownError
	require.ErrorAs(t, s.RunProvidersNow(context.Background(), []string{"linkedin"}), &pause)
}
