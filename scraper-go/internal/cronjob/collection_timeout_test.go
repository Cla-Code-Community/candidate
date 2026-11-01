package cronjob

import (
	"context"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

func TestCollectionTimeoutPersistsPartialJobsBeforeReleasingGlobalLock(t *testing.T) {
	scheduler, _, client := newConcurrentTestScheduler(t)
	scheduler.cfg.ScrapeTimeout = 20 * time.Millisecond
	completed := false
	scheduler.OnComplete = func([]string, int, int, time.Duration) { completed = true }
	scheduler.runCron(context.Background())
	count, err := scheduler.jobStore.Count(context.Background())
	require.NoError(t, err)
	require.Greater(t, count, int64(0))
	require.False(t, completed)
	require.False(t, scheduler.IsRunning())
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}
