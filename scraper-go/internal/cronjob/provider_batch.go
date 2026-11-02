package cronjob

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
)

const greenhouseCheckpointKey = "scraper:provider:greenhouse:checkpoint"

type batchCheckpoint struct {
	Manifest string `json:"manifest"`
	Offset   int    `json:"offset"`
}

var saveCheckpoint = redis.NewScript(`
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET',KEYS[2],ARGV[2])
return 1
`)

func (s *Scheduler) providerBatch(ctx context.Context, requested []string) ([]ports.JobSource, func(*runlock.Lease) error, error) {
	sources, err := pipeline.SelectProviders(s.adapterList, requested)
	if err != nil {
		return nil, nil, err
	}
	if len(requested) != 1 {
		return sources, nil, nil
	}
	provider, _ := ports.ParseProviderID(requested[0])
	if provider != ports.ProviderGreenhouse {
		return sources, nil, nil
	}
	if s.rdb == nil {
		return nil, nil, ErrLockUnavailable
	}
	// Sorting and hashing all source identities keeps resumed batches stable and
	// restarts safely at zero when the configured company registry changes.
	sources = append([]ports.JobSource(nil), sources...)
	sort.SliceStable(sources, func(i, j int) bool { return sources[i].SourceName() < sources[j].SourceName() })
	h := sha256.New()
	for _, source := range sources {
		fmt.Fprintf(h, "%d:%s\n", len(source.SourceName()), source.SourceName())
	}
	manifest := hex.EncodeToString(h.Sum(nil))
	state := batchCheckpoint{Manifest: manifest}
	raw, err := s.rdb.Get(ctx, greenhouseCheckpointKey).Result()
	if err != nil && err != redis.Nil {
		return nil, nil, err
	}
	if err == nil {
		if err := json.Unmarshal([]byte(raw), &state); err != nil {
			return nil, nil, fmt.Errorf("invalid greenhouse checkpoint: %w", err)
		}
	}
	if state.Manifest != manifest {
		state = batchCheckpoint{Manifest: manifest}
	}
	if state.Offset < 0 || state.Offset >= len(sources) {
		return nil, nil, fmt.Errorf("invalid greenhouse checkpoint offset")
	}
	size := s.cfg.GreenhouseBatchSize
	if size <= 0 || size > 1000 {
		size = 1000
	}
	end := min(len(sources), state.Offset+size)
	batch := sources[state.Offset:end]
	next := batchCheckpoint{Manifest: manifest, Offset: end % len(sources)}
	return batch, func(lease *runlock.Lease) error {
		payload, _ := json.Marshal(next)
		written, err := saveCheckpoint.Run(lease.Context(), s.rdb, []string{runlock.LockKey, greenhouseCheckpointKey}, lease.Token(), string(payload)).Int()
		if err != nil {
			return fmt.Errorf("greenhouse checkpoint: %w", err)
		}
		if written != 1 {
			return fmt.Errorf("%w: checkpoint ownership changed", runlock.ErrLost)
		}
		return nil
	}, nil
}
