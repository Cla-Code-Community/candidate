package pipeline

import (
	"context"
	"log/slog"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/redis/go-redis/v9"
)

type SearchConfig struct {
	Keywords              []string `json:"keywords"`
	SearchLocation        string   `json:"searchLocation"`
	SearchGeoID           string   `json:"searchGeoId"`
	SearchLanguage        string   `json:"searchLanguage"`
	JobTypes              string   `json:"jobTypes"`
	TimeFilter            string   `json:"timeFilter"`
	RemoteOnly            bool     `json:"remoteOnly"`
	Sources               []string `json:"sources"`
	ResultsPerPage        int      `json:"resultsPerPage"`
	MaxPagesPerKeyword    int      `json:"maxPagesPerKeyword"`
	WaitBetweenSearchesMs int      `json:"waitBetweenSearchesMs"`
	PageTimeoutMs         int      `json:"pageTimeoutMs"`
	MaxConcurrency        int      `json:"maxConcurrency"`
}

func normalizeSearchConfig(config SearchConfig) SearchConfig {
	config.Keywords = keywords.NormalizeKeywords(config.Keywords)
	return config
}

func ScrapeAllSources(
	ctx context.Context,
	config SearchConfig,
	adapterList []ports.JobSource,
	rdb *redis.Client,
) ([]domain.Job, error) {
	config = normalizeSearchConfig(config)
	slog.Info("starting scrape", "keywords", config.Keywords)

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

	jobs := Run(ctx, adapterList, req)

	slog.Info("scrape finished",
		"total_jobs", len(jobs),
		"keywords", len(config.Keywords),
		"adapters", len(adapterList),
	)

	return jobs, nil
}
