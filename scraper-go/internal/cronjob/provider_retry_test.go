package cronjob

import (
	"context"
	"errors"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"sync/atomic"
	"testing"
	"time"
)

func TestProviderRetryAfterSurvivesRestartAndDoesNotConsumeWindow(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	var calls atomic.Int32
	s.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderGreenhouse, name: "a", calls: &calls, err: &ports.RateLimitError{Provider: ports.ProviderGreenhouse, NotBefore: time.Now().Add(time.Hour)}}}
	runOneProvider(t, s, "greenhouse")
	require.Equal(t, "rate_limit", s.LastRun().ErrorType)
	require.NotEmpty(t, client.Get(context.Background(), providerRetryKey(ports.ProviderGreenhouse)).Val())
	restarted := New(s.cfg, s.kwStore, s.jobStore, s.adapterList, s.rdb, s.runLock)
	var limited *ports.RateLimitError
	require.True(t, errors.As(restarted.RunProvidersNow(context.Background(), []string{"greenhouse"}), &limited))
	require.Error(t, restarted.RunNow(context.Background())) // Global requests cannot bypass provider cooldowns.
	restarted.cfg.ProviderWindows = []config.ProviderWindow{{Provider: ports.ProviderGreenhouse, Start: 0, End: 1440}}
	now, _ := windowBounds(time.Now().Add(24*time.Hour), restarted.cfg.ProviderWindows[0])
	require.Error(t, restarted.dispatchProviderWindow(context.Background(), now))
	require.Len(t, client.Keys(context.Background(), "scraper:window:*").Val(), 1)
	require.EqualValues(t, 1, calls.Load())
	require.NoError(t, client.Set(context.Background(), providerRetryKey(ports.ProviderGreenhouse), time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano), 0).Err())
	restarted.adapterList = []ports.JobSource{dispatchSource{provider: ports.ProviderGreenhouse, name: "a", calls: &calls}}
	runOneProvider(t, restarted, "greenhouse")
	require.EqualValues(t, 2, calls.Load())
}
