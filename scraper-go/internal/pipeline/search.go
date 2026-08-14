package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/inflight"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

type SearchResult struct {
	Jobs      []domain.Job `json:"jobs"`
	Total     int          `json:"total"`
	CachedAt  time.Time    `json:"cachedAt"`
	FromCache bool         `json:"fromCache"`
}

func SearchJobs(
	ctx context.Context,
	c cache.Cache,
	config SearchConfig,
	adapterList []ports.JobSource,
	ttl time.Duration,
	rdb *redis.Client,
) (SearchResult, error) {
	config = normalizeSearchConfig(config)
	cacheKey := BuildCacheKey(config)

	if result, found, err := cache.GetAs[SearchResult](c, ctx, cacheKey); err != nil {
		return SearchResult{}, fmt.Errorf("pipeline.SearchJobs: cache read: %w", err)
	} else if found {
		result.FromCache = true
		return result, nil
	}

	return inflight.Do(cacheKey, func() (SearchResult, error) {
		if result, found, err := cache.GetAs[SearchResult](c, ctx, cacheKey); err != nil {
			return SearchResult{}, fmt.Errorf("pipeline.SearchJobs: cache re-check: %w", err)
		} else if found {
			result.FromCache = true
			return result, nil
		}

		jobs, err := ScrapeAllSources(ctx, config, adapterList, rdb)
		if err != nil {
			return SearchResult{}, fmt.Errorf("pipeline.SearchJobs: scrape: %w", err)
		}

		IndexJobsInValkey(ctx, rdb, jobs, config.Keywords)

		result := SearchResult{
			Jobs:      jobs,
			Total:     len(jobs),
			CachedAt:  time.Now(),
			FromCache: false,
		}

		if err := c.Set(ctx, cacheKey, result, ttl); err != nil {
			slog.Error("pipeline.SearchJobs: cache write failed",
				"key", cacheKey,
				"error", err,
			)
		}

		return result, nil
	})
}
