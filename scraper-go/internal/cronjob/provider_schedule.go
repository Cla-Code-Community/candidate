package cronjob

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
)

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
		if now.Before(start) || !now.Before(end) {
			continue
		}
		// Leave 30s for processing and 5s for releasing the global lease.
		remaining := end.Sub(now) - 35*time.Second
		if remaining <= 0 {
			return nil
		}
		if s.rdb == nil {
			return ErrLockUnavailable
		}
		key := windowOccurrenceKey(start, w)
		exists, err := s.rdb.Exists(ctx, key).Result()
		if err != nil {
			return err
		}
		if exists > 0 {
			return nil
		}
		if err := s.checkProviderDelay(ctx, []string{string(w.Provider)}); err != nil {
			return err
		}
		windowCtx, cancel := context.WithDeadline(ctx, end.Add(-5*time.Second))
		defer cancel()
		lease, err := s.acquire(windowCtx, "cron")
		if errors.Is(err, ErrAlreadyRunning) {
			return nil
		} // Retry during this window after the active run finishes.
		if err != nil {
			return err
		}
		claimed, err := s.rdb.SetNX(windowCtx, key, lease.RunID(), 48*time.Hour).Result()
		if err != nil || !claimed {
			s.active.Done()
			releaseCtx, stop := context.WithTimeout(context.Background(), 5*time.Second)
			defer stop()
			_ = lease.Release(releaseCtx)
			metrics.FinishRun(context.Canceled, lease.RunID())
			return err
		}
		defer s.active.Done()
		fields := []any{"provider", w.Provider, "window_id", w.WindowID(), "local_date", start.Format("2006-01-02"), "timezone", w.Location().String(), "window_end", end, "run_id", lease.RunID()}
		slog.Info("provider window started", fields...)
		err = s.runSelectedWithLease(lease, []string{string(w.Provider)}, min(s.cfg.ScrapeTimeout, remaining))
		slog.Info("provider window finished", append(fields, "errorType", metrics.ErrorType(err))...)
		return err
	}
	return nil
}

func (s *Scheduler) ProviderWindows() []config.ProviderWindow {
	return append([]config.ProviderWindow(nil), s.cfg.ProviderWindows...)
}
