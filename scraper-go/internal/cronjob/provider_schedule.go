package cronjob

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
)

// ProviderStartTolerance accommodates the existing 15-second polling cadence.
// It never permits retrying a consumed or impeded occurrence.
const ProviderStartTolerance = 30 * time.Second

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

// Windows use the existing global lease. A persistent daily claim prevents
// repeated starts after completion, replica startup or a process restart.
func (s *Scheduler) startProviderWindows(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	defer metrics.SetNextRun(time.Time{})
	for {
		if err := s.dispatchProviderWindow(ctx, time.Now().UTC()); err != nil {
			slog.Warn("provider window not executed", "errorType", metrics.ErrorType(err))
		}
		select {
		case <-ctx.Done():
			return
		case <-s.stop:
			return
		case <-ticker.C:
		}
	}
}

func windowBounds(now time.Time, w config.ProviderWindow) (time.Time, time.Time) {
	loc := w.Location()
	now = now.In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), w.Start/60, w.Start%60, 0, 0, loc),
		time.Date(now.Year(), now.Month(), now.Day(), w.End/60, w.End%60, 0, 0, loc)
}

func nextWindowStart(now time.Time, w config.ProviderWindow) time.Time {
	start, _ := windowBounds(now, w)
	if !start.After(now) {
		start, _ = windowBounds(now.In(w.Location()).AddDate(0, 0, 1), w)
	}
	return start
}

func windowOccurrenceKey(start time.Time, w config.ProviderWindow) string {
	// Keep the existing persisted key for legacy configurations across upgrades.
	if w.ID == "" && w.Location() == time.UTC {
		return fmt.Sprintf("scraper:window:%s:%s:%d", start.Format("2006-01-02"), w.Provider, w.Start)
	}
	return fmt.Sprintf("scraper:window:%s:%s:%s", w.Location().String(), start.Format("2006-01-02"), w.WindowID())
}

func (s *Scheduler) dispatchProviderWindow(ctx context.Context, now time.Time) error {
	clock := s.admissionClock
	if clock == nil {
		clock = time.Now
	}
	// Include coordination latency in the schedule timestamp. Monotonic elapsed
	// time prevents wall-clock adjustments from reopening the admission period.
	dispatchStarted := clock()
	var next time.Time
	for _, w := range s.cfg.ProviderWindows {
		start := nextWindowStart(now, w)
		if next.IsZero() || start.Before(next) {
			next = start
		}
	}
	metrics.SetNextRun(next)
	for _, w := range s.cfg.ProviderWindows {
		start, end := windowBounds(now, w)
		if !now.Before(end) {
			if err := s.omitProviderWindow(ctx, start, w, "window_expired"); err != nil {
				return err
			}
			continue
		}
		if now.Before(start) || !now.Before(end) {
			continue
		}
		if now.Sub(start) > ProviderStartTolerance {
			if err := s.omitProviderWindow(ctx, start, w, "late_start"); err != nil {
				return err
			}
			continue
		}
		key := windowOccurrenceKey(start, w)
		attempt := "admitting:" + rand.Text()
		s.mu.Lock()
		previous := s.failedAdmissions[key]
		s.mu.Unlock()
		if previous != "" && s.rdb != nil {
			value, readErr := s.rdb.Get(ctx, key).Result()
			if readErr == redis.Nil {
				return s.omitProviderWindow(ctx, start, w, "admission_unavailable")
			}
			if readErr != nil {
				return readErr
			}
			if value == previous {
				return s.rdb.SetXX(ctx, key, "missed:admission_unavailable", 48*time.Hour).Err()
			}
			return nil
		}
		rememberFailure := func() {
			s.mu.Lock()
			defer s.mu.Unlock()
			if s.failedAdmissions == nil {
				s.failedAdmissions = map[string]string{}
			}
			s.failedAdmissions[key] = attempt
		}
		if s.rdb == nil {
			rememberFailure()
			return ErrLockUnavailable
		}
		claimed, err := s.rdb.SetNX(ctx, key, attempt, 48*time.Hour).Result()
		if err != nil {
			rememberFailure()
		}
		if err != nil || !claimed {
			return err
		}
		miss := func(reason string, cause error) error {
			written, updateErr := s.rdb.SetXX(ctx, key, "missed:"+reason, 48*time.Hour).Result()
			if written {
				slog.Warn("provider window missed", "provider", w.Provider, "window_id", w.WindowID(), "local_date", start.Format("2006-01-02"), "reason", reason)
			}
			return errors.Join(cause, updateErr)
		}
		if err := s.checkProviderDelay(ctx, []string{string(w.Provider)}); err != nil {
			return miss("provider_delay", err)
		}
		deadline := minTime(end, start.Add(runlock.MaxExecutionDuration))
		windowCtx, cancel := context.WithDeadline(ctx, deadline)
		defer cancel()
		lease, err := s.acquire(windowCtx, "cron")
		if err != nil {
			var pause *runlock.CooldownError
			if errors.As(err, &pause) {
				return miss("global_pause", nil)
			}
			if errors.Is(err, ErrAlreadyRunning) {
				return miss("lock_busy", nil)
			}
			return miss("admission_failed", err)
		}
		if err := s.rdb.Set(windowCtx, key, lease.RunID(), 48*time.Hour).Err(); err != nil {
			s.active.Done()
			releaseCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			_ = lease.Release(releaseCtx)
			metrics.FinishRun(err, lease.RunID())
			return err
		}

		defer s.active.Done()
		// Decide admission while holding the global lease, after the last Redis
		// operation. A slow claim or lock acquisition must never cause catch-up.
		if now.Add(clock().Sub(dispatchStarted)).Sub(start) > ProviderStartTolerance {
			missErr := miss("admission_late", nil)
			releaseCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			releaseErr := lease.Release(releaseCtx)
			metrics.FinishRun(context.Canceled, lease.RunID())
			return errors.Join(missErr, releaseErr)
		}
		fields := []any{"provider", w.Provider, "window_id", w.WindowID(), "local_date", start.Format("2006-01-02"), "timezone", w.Location().String(), "window_end", end, "run_id", lease.RunID()}
		slog.Info("provider window started", fields...)
		err = s.runSelectedWindowWithLease(lease, []string{string(w.Provider)}, s.cfg.ScrapeTimeout, &w)
		slog.Info("provider window finished", append(fields, "errorType", metrics.ErrorType(err))...)
		return err
	}
	return nil
}

func (s *Scheduler) omitProviderWindow(ctx context.Context, start time.Time, w config.ProviderWindow, reason string) error {
	if s.rdb == nil {
		return ErrLockUnavailable
	}
	written, err := s.rdb.SetNX(ctx, windowOccurrenceKey(start, w), "missed:"+reason, 48*time.Hour).Result()
	if written {
		slog.Warn("provider window omitted", "provider", w.Provider, "window_id", w.WindowID(), "local_date", start.Format("2006-01-02"), "reason", reason)
	}
	return err
}

func (s *Scheduler) ProviderWindows() []config.ProviderWindow {
	return append([]config.ProviderWindow(nil), s.cfg.ProviderWindows...)
}
