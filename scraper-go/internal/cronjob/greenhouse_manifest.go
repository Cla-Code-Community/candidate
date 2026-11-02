package cronjob

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
)

// The reviewed manifest is the persistent assignment, not a slice recomputed
// from the live registry. Catalog drift fails closed. To add/remove boards,
// edit explicit memberships, bump the version and review the diff. Preserve
// every retained board's group; never regenerate all groups from a new sort.
// A version already pinned in Valkey is immutable, including across replicas.
//
//go:embed greenhouse_manifest_v1.json
var greenhouseManifestJSON []byte

type greenhouseManifest struct {
	Version string              `json:"version"`
	Groups  map[string][]string `json:"groups"`
}

func parseGreenhouseManifest(data []byte) (greenhouseManifest, string, error) {
	var m greenhouseManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return m, "", fmt.Errorf("greenhouse manifest: %w", err)
	}
	if !strings.HasPrefix(m.Version, "greenhouse-v") || len(m.Version) <= len("greenhouse-v") || len(m.Groups) != 4 {
		return m, "", fmt.Errorf("invalid greenhouse manifest version/groups")
	}
	seen := map[string]bool{}
	for i := 1; i <= 4; i++ {
		group, ok := m.Groups[fmt.Sprintf("greenhouse-%d", i)]
		if !ok {
			return m, "", fmt.Errorf("missing greenhouse group %d", i)
		}
		for _, id := range group {
			if id == "" || id != strings.TrimSpace(id) || seen[id] {
				return m, "", fmt.Errorf("invalid/duplicate greenhouse board identity %q", id)
			}
			seen[id] = true
		}
	}
	if len(seen) == 0 {
		return m, "", fmt.Errorf("empty greenhouse manifest")
	}
	// Canonical JSON avoids treating formatting or map order as a migration.
	canonical, _ := json.Marshal(m)
	digest := sha256.Sum256(canonical)
	return m, hex.EncodeToString(digest[:]), nil
}

func (m greenhouseManifest) selectGroup(sources []ports.JobSource, windowID string) ([]ports.JobSource, error) {
	group, ok := m.Groups[windowID]
	if !ok {
		return nil, fmt.Errorf("unknown greenhouse group %q", windowID)
	}
	byID := map[string]ports.JobSource{}
	for _, source := range sources {
		if ports.CapabilitiesOf(source).Provider != ports.ProviderGreenhouse {
			continue
		}
		stable, ok := source.(ports.StableJobSource)
		if !ok || stable.SourceID() == "" {
			return nil, fmt.Errorf("greenhouse adapter lacks stable board identity")
		}
		id := stable.SourceID()
		if _, duplicate := byID[id]; duplicate {
			return nil, fmt.Errorf("duplicate greenhouse adapter identity %q", id)
		}
		byID[id] = source
	}
	// Validate the complete catalog before starting any group. A removal is not
	// silently filled by another company, and an addition is never auto-assigned.
	count := 0
	for _, ids := range m.Groups {
		for _, id := range ids {
			if _, ok := byID[id]; !ok {
				return nil, fmt.Errorf("greenhouse catalog drift: missing board %q; review manifest %s", id, m.Version)
			}
			count++
		}
	}
	if len(byID) != count {
		return nil, fmt.Errorf("greenhouse catalog drift: unassigned boards; review manifest %s", m.Version)
	}
	batch := make([]ports.JobSource, 0, len(group))
	for _, id := range group {
		batch = append(batch, byID[id])
	}
	return batch, nil
}

var pinGreenhouseManifest = redis.NewScript(`
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return -1 end
local current = redis.call('GET',KEYS[2])
if current and current ~= ARGV[2] then return 0 end
if not current then redis.call('SET',KEYS[2],ARGV[2]) end
return 1
`)

func (s *Scheduler) greenhouseFixedBatch(ctx context.Context, lease *runlock.Lease, windowID string) ([]ports.JobSource, error) {
	manifest, digest, err := parseGreenhouseManifest(greenhouseManifestJSON)
	if err != nil {
		return nil, err
	}
	batch, err := manifest.selectGroup(s.adapterList, windowID)
	if err != nil {
		return nil, err
	}
	if s.rdb == nil {
		return nil, ErrLockUnavailable
	}
	written, err := pinGreenhouseManifest.Run(ctx, s.rdb, []string{runlock.LockKey, "scraper:provider:greenhouse:manifest:" + manifest.Version}, lease.Token(), digest).Int()
	if err != nil {
		return nil, fmt.Errorf("pin greenhouse manifest: %w", err)
	}
	if written == -1 {
		return nil, fmt.Errorf("%w: greenhouse manifest ownership changed", runlock.ErrLost)
	}
	if written != 1 {
		return nil, fmt.Errorf("greenhouse manifest %s changed without a version migration", manifest.Version)
	}
	slog.Info("greenhouse fixed group selected", "manifest_version", manifest.Version, "manifest_hash", digest, "window_id", windowID, "adapters", len(batch), "run_id", lease.RunID())
	return batch, nil
}
