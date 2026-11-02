package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	cfgpkg "github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/redis/go-redis/v9"
)

type SearchConfig struct {
	CollectionTimeout            time.Duration            `json:"-"`
	CollectionDeadline           time.Time                `json:"-"`
	Store                        *jobstore.Store          `json:"-"`
	Keywords                     []string                 `json:"keywords"`
	SearchLocation               string                   `json:"searchLocation"`
	SearchGeoID                  string                   `json:"searchGeoId"`
	SearchLanguage               string                   `json:"searchLanguage"`
	JobTypes                     string                   `json:"jobTypes"`
	TimeFilter                   string                   `json:"timeFilter"`
	RemoteOnly                   bool                     `json:"remoteOnly"`
	Sources                      []string                 `json:"sources"`
	ResultsPerPage               int                      `json:"resultsPerPage"`
	MaxPagesPerKeyword           int                      `json:"maxPagesPerKeyword"`
	WaitBetweenSearchesMs        int                      `json:"waitBetweenSearchesMs"`
	PageTimeoutMs                int                      `json:"pageTimeoutMs"`
	MaxConcurrency               int                      `json:"maxConcurrency"`
	ProviderMaxConcurrency       int                      `json:"-"`
	ProviderConcurrencyOverrides map[ports.ProviderID]int `json:"-"`
	RunID                        string                   `json:"-"`
	ClassificationBatchSize      int                      `json:"-"`
	PersistBatchSize             int                      `json:"-"`
	IndexBatchSize               int                      `json:"-"`
}

type collectionFailure struct {
	count int
	cause error
}

func (e collectionFailure) Error() string {
	return fmt.Sprintf("collection: %d task(s) failed", e.count)
}
func (e collectionFailure) Unwrap() error { return e.cause }

func normalizeSearchConfig(config SearchConfig) SearchConfig {
	config.Keywords = keywords.GenerateSearchKeywords(config.Keywords)
	if config.ProviderMaxConcurrency <= 0 {
		config.ProviderMaxConcurrency = min(2, max(1, config.MaxConcurrency))
	}
	return config
}

func ScrapeAllSources(
	ctx context.Context,
	config SearchConfig,
	adapterList []ports.JobSource,
	rdb *redis.Client,
) ([]domain.Job, ProcessStats, error) {
	adapterList, err := selectProviders(adapterList, config.Sources)
	if err != nil {
		return nil, ProcessStats{}, err
	}
	config = normalizeSearchConfig(config)
	if config.Store != nil && config.Store.Durable() {
		release, err := config.Store.ProcessingLease(ctx)
		if err != nil {
			return nil, ProcessStats{}, fmt.Errorf("catalog processing lease: %w", err)
		}
		defer release()
	}
	slog.Info("starting scrape", "keywords_total", len(config.Keywords), "run_id", config.RunID, "stage", "collection")
	slog.Info("scraper concurrency budget",
		"global_limit", config.MaxConcurrency,
		"provider_default_limit", config.ProviderMaxConcurrency,
		"provider_overrides", formatProviderOverrides(config.ProviderConcurrencyOverrides),
	)

	processCfg := processConfig{
		CollectionTimeout:       config.CollectionTimeout,
		CollectionDeadline:      config.CollectionDeadline,
		RunID:                   config.RunID,
		Keywords:                config.Keywords,
		ClassificationBatchSize: config.ClassificationBatchSize,
		PersistBatchSize:        config.PersistBatchSize,
		IndexBatchSize:          config.IndexBatchSize,
	}
	if processCfg.ClassificationBatchSize <= 0 {
		processCfg.ClassificationBatchSize = cfgpkg.DefaultClassificationBatchSize
	}
	if processCfg.PersistBatchSize <= 0 {
		processCfg.PersistBatchSize = cfgpkg.DefaultPersistBatchSize
	}
	if processCfg.IndexBatchSize <= 0 {
		processCfg.IndexBatchSize = cfgpkg.DefaultIndexBatchSize
	}

	slog.Info("scraper batch sizes",
		"run_id", config.RunID,
		"classification_batch_size", processCfg.ClassificationBatchSize,
		"persist_batch_size", processCfg.PersistBatchSize,
		"index_batch_size", processCfg.IndexBatchSize,
	)

	adapterList = filterAdaptersByCadence(ctx, rdb, adapterList)

	req := domain.ScrapeRequest{
		Keywords:              config.Keywords,
		SearchLocation:        config.SearchLocation,
		SearchGeoID:           config.SearchGeoID,
		SearchLanguage:        config.SearchLanguage,
		JobTypes:              config.JobTypes,
		TimeFilter:            config.TimeFilter,
		RemoteOnly:            config.RemoteOnly,
		Sources:               config.Sources,
		ResultsPerPage:        config.ResultsPerPage,
		MaxPagesPerKeyword:    config.MaxPagesPerKeyword,
		WaitBetweenSearchesMs: config.WaitBetweenSearchesMs,
		PageTimeoutMs:         config.PageTimeoutMs,
		MaxConcurrency:        config.MaxConcurrency,
	}
	if rdb != nil {
		processCfg.RDB = rdb
		processCfg.Store = config.Store
		if processCfg.Store == nil {
			processCfg.Store = jobstore.New(rdb)
		}
	}

	jobs, stats, err := runWithConcurrency(
		ctx,
		adapterList,
		req,
		config.ProviderMaxConcurrency,
		config.ProviderConcurrencyOverrides,
		processCfg,
	)
	if err != nil {
		return jobs, stats, err
	}
	if stats.CollectionFailed > 0 {
		return jobs, stats, collectionFailure{stats.CollectionFailed, stats.CollectionError}
	}

	slog.Info("scrape finished",
		"total_jobs", len(jobs),
		"received", stats.Received,
		"inserted", stats.Inserted,
		"updated", stats.Updated,
		"saved", stats.Saved(),
		"failed", stats.Failed,
		"keywords", len(config.Keywords),
		"adapters", len(adapterList),
	)

	return jobs, stats, nil
}

func formatProviderOverrides(overrides map[ports.ProviderID]int) string {
	values := make([]string, 0, len(overrides))
	for provider, limit := range overrides {
		values = append(values, fmt.Sprintf("%s=%d", provider, limit))
	}
	sort.Strings(values)
	return strings.Join(values, ",")
}
