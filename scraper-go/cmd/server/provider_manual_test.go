package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cronjob"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
)

type manualSource struct {
	provider ports.ProviderID
	calls    *atomic.Int32
}

func (s manualSource) SourceName() string { return string(s.provider) }
func (s manualSource) Capabilities() ports.SourceCapabilities {
	return ports.SourceCapabilities{Provider: s.provider, Mode: ports.DiscoveryKeyword}
}
func (s manualSource) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	s.calls.Add(1)
	return nil, nil
}

func TestAdminManualProviderBodyIsValidatedAndIsolated(t *testing.T) {
	_, manager, client, _ := newHandlerTestScheduler(t)
	var linkedin, gupy atomic.Int32
	cfg := cronjob.DefaultConfig()
	cfg.ScrapeTimeout = time.Second
	scheduler := cronjob.New(cfg, keywords.NewStore(cache.NewRedisCache(client)), jobstore.New(client), []ports.JobSource{manualSource{ports.ProviderLinkedIn, &linkedin}, manualSource{ports.ProviderGupy, &gupy}}, client, manager)
	for _, body := range []string{`{"sources":["unknown"]}`, `{"sources":[1]}`, `{"other":true}`, `{"sources":["linkedin"]} {}`} {
		w := httptest.NewRecorder()
		handleTriggerScrape(scheduler, context.Background()).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/admin/scrape", strings.NewReader(body)))
		require.Equal(t, http.StatusBadRequest, w.Code)
	}
	require.Zero(t, linkedin.Load())
	require.Zero(t, gupy.Load())
	w := httptest.NewRecorder()
	handleTriggerScrape(scheduler, context.Background()).ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/admin/scrape", strings.NewReader(`{"sources":["linkedin"]}`)))
	require.Equal(t, http.StatusOK, w.Code)
	require.Eventually(t, func() bool { return scheduler.LastRun() != nil }, time.Second, time.Millisecond)
	require.EqualValues(t, 1, linkedin.Load())
	require.Zero(t, gupy.Load())
	require.Equal(t, []string{"linkedin"}, scheduler.LastRun().Providers)
}
