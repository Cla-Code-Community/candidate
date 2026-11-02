package cronjob

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/adapterutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
)

type keywordWindowCall struct {
	keywords []string
	req      domain.ScrapeRequest
	deadline time.Time
}
type keywordWindowSource struct {
	provider ports.ProviderID
	calls    []keywordWindowCall
	search   func(context.Context, []string, domain.ScrapeRequest) ([]domain.Job, error)
}

func (a *keywordWindowSource) SourceName() string { return string(a.provider) }
func (a *keywordWindowSource) Capabilities() ports.SourceCapabilities {
	return ports.SourceCapabilities{Provider: a.provider, Mode: ports.DiscoveryBatch}
}
func (a *keywordWindowSource) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	return nil, errors.New("expected batch discovery")
}
func (a *keywordWindowSource) SearchBatch(ctx context.Context, kw []string, req domain.ScrapeRequest) ([]domain.Job, error) {
	deadline, _ := ctx.Deadline()
	a.calls = append(a.calls, keywordWindowCall{append([]string(nil), kw...), req, deadline})
	if a.search != nil {
		return a.search(ctx, kw, req)
	}
	return nil, nil
}

func TestPresetKeywordWindowsReceiveFullConfiguredSetAndKeepManualCompatibility(t *testing.T) {
	s, _, client := newConcurrentTestScheduler(t)
	linkedin := &keywordWindowSource{provider: ports.ProviderLinkedIn}
	adzuna := &keywordWindowSource{provider: ports.ProviderAdzuna}
	s.adapterList = []ports.JobSource{linkedin, adzuna}
	windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
	require.NoError(t, err)
	s.cfg.ProviderWindows = windows
	var configured []string
	for i := 0; i < 37; i++ {
		configured = append(configured, fmt.Sprintf("query-%02d", i))
	}
	require.NoError(t, s.kwStore.Save(context.Background(), configured))
	expected := keywords.GenerateSearchKeywords(configured)
	day := time.Now().In(mustProviderLocation(t)).AddDate(0, 0, 1)
	for _, w := range windows {
		if w.Provider != ports.ProviderLinkedIn && w.Provider != ports.ProviderAdzuna {
			continue
		}
		start, _ := windowBounds(day, w)
		require.NoError(t, s.dispatchProviderWindow(context.Background(), start))
		target := linkedin
		if w.Provider == ports.ProviderAdzuna {
			target = adzuna
		}
		call := target.calls[len(target.calls)-1]
		require.Equal(t, expected, call.keywords)
		require.True(t, call.req.FullKeywordCoverage)
		require.Equal(t, w.WindowID(), call.req.WindowID)
		require.NotEmpty(t, call.req.RunID)
		require.Equal(t, s.cfg.MaxConcurrency, call.req.MaxConcurrency)
		require.WithinDuration(t, time.Now(), call.deadline, s.cfg.ScrapeTimeout)
	}
	require.Len(t, linkedin.calls, 3)
	require.Len(t, adzuna.calls, 2)
	runOneProvider(t, s, "linkedin")
	require.False(t, linkedin.calls[3].req.FullKeywordCoverage)
	require.Empty(t, linkedin.calls[3].req.WindowID)
	require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
}

func TestKeywordWindowPartialResultsPreservePersistenceAndRetryState(t *testing.T) {
	for _, provider := range []ports.ProviderID{ports.ProviderLinkedIn, ports.ProviderAdzuna} {
		t.Run(string(provider), func(t *testing.T) {
			for _, kind := range []string{"timeout", "rate_limit"} {
				t.Run(kind, func(t *testing.T) {
					s, _, client := newConcurrentTestScheduler(t)
					s.cfg.ScrapeTimeout = 80 * time.Millisecond
					source := &keywordWindowSource{provider: provider}
					calls := 0
					source.search = func(ctx context.Context, kw []string, req domain.ScrapeRequest) ([]domain.Job, error) {
						require.True(t, req.FullKeywordCoverage)
						return adapterutil.SearchAllKeywords(ctx, kw, req, provider, func(ctx context.Context, _ string, _ domain.ScrapeRequest) ([]domain.Job, error) {
							calls++
							if calls == 1 {
								job := schedulerTestJob()
								job.Source = string(provider)
								return []domain.Job{job}, nil
							}
							if kind == "timeout" {
								<-ctx.Done()
								return nil, ctx.Err()
							}
							return nil, &ports.RateLimitError{Provider: provider, NotBefore: time.Now().Add(time.Hour)}
						})
					}
					s.adapterList = []ports.JobSource{source}
					require.NoError(t, s.kwStore.Save(context.Background(), []string{"go", "java", "rust"}))
					windows, err := config.ParseProviderWindows(config.ProviderSchedulePreset)
					require.NoError(t, err)
					index := 3
					if provider == ports.ProviderAdzuna {
						index = 4
					}
					w := windows[index]
					require.Equal(t, string(provider)+"-1", w.WindowID())
					s.cfg.ProviderWindows = []config.ProviderWindow{w}
					start, _ := windowBounds(time.Now().Add(24*time.Hour), w)
					require.Error(t, s.dispatchProviderWindow(context.Background(), start))
					require.Equal(t, "partial", s.LastRun().Status)
					require.Positive(t, s.LastRun().JobsSaved)
					require.Positive(t, s.LastRun().JobsIndexed)
					require.Equal(t, 2, calls)
					require.NoError(t, s.dispatchProviderWindow(context.Background(), start.Add(time.Second)))
					require.Equal(t, 2, calls)
					if kind == "rate_limit" {
						require.NotEmpty(t, client.Get(context.Background(), providerRetryKey(provider)).Val())
						var limit *ports.RateLimitError
						require.ErrorAs(t, s.RunProvidersNow(context.Background(), []string{string(provider)}), &limit)
					}
					require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
				})
			}
		})
	}
}
