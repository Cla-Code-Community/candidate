package cronjob

import (
	"context"
	"fmt"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
)

func providerRetryKey(provider ports.ProviderID) string {
	return "scraper:provider:" + string(provider) + ":retry_after"
}

func (s *Scheduler) retryProviders(requested []string) []ports.ProviderID {
	if len(requested) == 0 {
		for _, source := range s.adapterList {
			requested = append(requested, string(ports.CapabilitiesOf(source).Provider))
		}
	}
	var providers []ports.ProviderID
	seen := map[ports.ProviderID]bool{}
	for _, name := range requested {
		if provider, known := ports.ParseProviderID(name); known && !seen[provider] {
			seen[provider] = true
			providers = append(providers, provider)
		}
	}
	return providers
}

func (s *Scheduler) checkProviderDelay(ctx context.Context, sources []string) error {
	for _, provider := range s.retryProviders(sources) {
		if s.rdb == nil {
			return ErrLockUnavailable
		}
		value, err := s.rdb.Get(ctx, providerRetryKey(provider)).Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			return err
		}
		at, err := time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return fmt.Errorf("invalid provider retry state: %w", err)
		}
		if time.Now().Before(at) {
			return &ports.RateLimitError{Provider: provider, NotBefore: at}
		}
	}
	return nil
}

func (s *Scheduler) rememberRetryAfter(lease *runlock.Lease, sources []string, collectionError error) error {
	for _, provider := range s.retryProviders(sources) {
		at := ports.LatestRetryAfter(collectionError, provider)
		if !at.After(time.Now()) {
			continue
		}
		value, err := saveCheckpoint.Run(lease.Context(), s.rdb, []string{runlock.LockKey, providerRetryKey(provider)}, lease.Token(), at.UTC().Format(time.RFC3339Nano)).Int()
		if err != nil {
			return fmt.Errorf("provider retry state: %w", err)
		}
		if value != 1 {
			return runlock.ErrLost
		}
	}
	return nil
}
