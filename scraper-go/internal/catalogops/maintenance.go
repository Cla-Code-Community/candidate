// Package catalogops runs explicit, cancellable catalog maintenance; never at startup.
package catalogops

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalog"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/classifier"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/redis/go-redis/v9"
)

type Reader interface {
	Batch(context.Context, string, int, time.Time) ([]domain.Job, error)
	GetByIDs(context.Context, []string) ([]domain.Job, error)
}
type Maintenance struct {
	Store     *catalog.Store
	Index     *jobindex.Manager
	BatchSize int
	Keywords  []string
}

func (m *Maintenance) size() int {
	if m.BatchSize < 1 {
		return 200
	}
	return m.BatchSize
}
func (m *Maintenance) keys(j domain.Job) []string {
	return pipeline.IndexKeys(j, append(append(append([]string{}, m.Keywords...), j.Keywords...), j.Keyword))
}

type Report struct {
	Active     int `json:"active"`
	Missing    int `json:"missing"`
	Stale      int `json:"stale"`
	Membership int `json:"membership"`
	Primary    int `json:"primary"`
	Related    int `json:"related"`
	Any        int `json:"any"`
	Invalid    int `json:"invalid"`
	Documents  int `json:"documents"`
	Counts     int `json:"counts"`
}

func (r Report) Divergent() bool {
	return r.Missing+r.Stale+r.Membership+r.Primary+r.Related+r.Any+r.Invalid+r.Documents+r.Counts > 0
}

func (m *Maintenance) Rebuild(ctx context.Context) (string, error) {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return "", err
	}
	defer release()
	return m.rebuildLocked(ctx)
}
func (m *Maintenance) rebuildLocked(ctx context.Context) (string, error) {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	version := "v2-" + hex.EncodeToString(bytes)
	previous, err := m.Index.Active(ctx)
	if err != nil {
		return "", err
	}
	at := m.Store.Now().UTC()
	cursor := ""
	total := 0
	// Even an empty catalog has a validated namespace manifest.
	if err = m.Index.RDB.SAdd(ctx, jobindex.Prefix(version)+"keys", jobindex.Prefix(version)+"index", jobindex.Prefix(version)+"expires").Err(); err != nil {
		return "", err
	}
	if err = m.Index.RDB.Expire(ctx, jobindex.Prefix(version)+"keys", m.Store.Lifetime).Err(); err != nil {
		return "", err
	}
	for {
		jobs, e := m.Store.Batch(ctx, cursor, m.size(), at)
		if e != nil {
			return "", e
		}
		if len(jobs) == 0 {
			break
		}
		if _, e = m.Index.ApplyVersion(ctx, version, jobs, m.keys, true); e != nil {
			slog.Error("catalog rebuild invalid batch", "version", version, "batch_size", len(jobs))
			return "", e
		}
		cursor = jobs[len(jobs)-1].ID
		total += len(jobs)
		slog.Info("catalog rebuild batch", "version", version, "batch_size", len(jobs), "processed", total)
	}
	report, err := Compare(ctx, m.Store, m.Index, version, m.size(), m.keys)
	if err != nil {
		return "", err
	}
	if report.Divergent() {
		return "", fmt.Errorf("rebuild validation failed: %+v", report)
	}
	familyKeys := []string{}
	for _, family := range taxonomy.Families() {
		for _, kind := range []string{"family:", "family:primary:", "family:related:"} {
			familyKeys = append(familyKeys, kind+family.ID)
		}
	}
	raw, _ := json.Marshal(familyKeys)
	_, err = publish.Run(ctx, m.Index.RDB, []string{jobindex.ActiveKey, jobindex.GenerationKey}, previous, version, jobindex.Prefix(version), string(raw)).Result()
	if err != nil {
		return "", fmt.Errorf("publish catalog namespace: %w", err)
	}

	// Record only revisions belonging to the successfully published projection.
	cursor = ""
	for {
		jobs, e := m.Store.Batch(ctx, cursor, m.size(), at)
		if e != nil {
			return "", e
		}
		if len(jobs) == 0 {
			break
		}
		if e = m.Store.MarkIndexed(ctx, jobs); e != nil {
			return "", fmt.Errorf("rebuild indexed checkpoint: %w", e)
		}
		cursor = jobs[len(jobs)-1].ID
	}
	slog.Info("catalog rebuild published", "version", version, "previous_version", previous, "active", report.Active)
	return version, nil
}

var publish = redis.NewScript(`
local previous,version,prefix,families=ARGV[1],ARGV[2],ARGV[3],cjson.decode(ARGV[4])
local function typed(k,want) local t=redis.call('TYPE',k).ok;if t~='none' and t~=want then error('WRONGTYPE rebuild preflight') end end
typed(KEYS[1],'string');typed(KEYS[2],'string');typed('scraper:jobs:previous-index-version','string')
if (redis.call('GET',KEYS[1]) or 'bootstrap')~=previous then return redis.error_reply('active namespace changed') end
local g=redis.call('GET',KEYS[2]);if g and (not string.match(g,'^%d+$') or tonumber(g)>=9007199254740991) then error('invalid generation') end
typed(prefix..'keys','set');typed(prefix..'index','set');typed(prefix..'expires','zset');typed('scraper:jobs:index','set');typed('scraper:jobs:expires','zset')
for _,k in ipairs(families) do typed(prefix..k,'set');typed('scraper:jobs:'..k,'set') end
for _,k in ipairs(families) do redis.call('SUNIONSTORE','scraper:jobs:'..k,prefix..k) end
redis.call('SUNIONSTORE','scraper:jobs:index',prefix..'index')
redis.call('ZUNIONSTORE','scraper:jobs:expires',1,prefix..'expires')
redis.call('SET','scraper:jobs:previous-index-version',previous)
redis.call('PERSIST',prefix..'keys');redis.call('PERSIST',prefix..'index');redis.call('PERSIST',prefix..'expires');
redis.call('SET',KEYS[1],version);redis.call('INCR',KEYS[2]);return 1
`)

func (m *Maintenance) Reconcile(ctx context.Context, fix bool) (Report, error) {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return Report{}, err
	}
	defer release()
	version, err := m.Index.Active(ctx)
	if err != nil {
		return Report{}, err
	}
	report, err := Compare(ctx, m.Store, m.Index, version, m.size(), m.keys)
	if err != nil {
		return report, err
	}
	if fix && report.Divergent() {
		_, err = m.rebuildLocked(ctx)
	}
	return report, err
}

// Compare streams SQL rows and each family Set. Only one batch of payloads/IDs
// is retained. Redis membership probes are pipelined, not a round trip per job.
func Compare(ctx context.Context, source Reader, manager *jobindex.Manager, version string, size int, keys func(domain.Job) []string) (Report, error) {
	report := Report{}
	prefix := jobindex.Prefix(version)
	after := ""
	at := manager.Now().UTC()
	for {
		jobs, err := source.Batch(ctx, after, size, at)
		if err != nil {
			return report, err
		}
		if len(jobs) == 0 {
			break
		}
		pipe := manager.RDB.Pipeline()
		metas := make([]*redis.StringCmd, len(jobs))
		docs := make([]*redis.StringCmd, len(jobs))
		checks := make([][]*redis.BoolCmd, len(jobs))
		expected := make([]jobindex.Plan, len(jobs))
		for i, j := range jobs {
			plan, e := jobindex.Build(j, keys(j))
			if e != nil {
				report.Invalid++
				continue
			}
			expected[i] = plan
			report.Active++
			metas[i] = pipe.Get(ctx, prefix+"index-membership:"+j.ID)
			docs[i] = pipe.Get(ctx, prefix+"job:"+j.ID)
			checks[i] = append(checks[i], pipe.SIsMember(ctx, prefix+"index", j.ID))
			for _, k := range plan.Keys {
				checks[i] = append(checks[i], pipe.SIsMember(ctx, prefix+k, j.ID))
			}
		}
		if _, err = pipe.Exec(ctx); err != nil && err != redis.Nil {
			return report, err
		}
		for i, j := range jobs {
			if metas[i] == nil {
				continue
			}
			if metas[i].Err() == redis.Nil {
				report.Missing++
			} else if metas[i].Err() != nil {
				return report, metas[i].Err()
			} else {
				var p jobindex.Plan
				if json.Unmarshal([]byte(metas[i].Val()), &p) != nil || p.Revision != j.CatalogRevision || p.Expires != j.CatalogExpiresAt.Unix() || p.Taxonomy != taxonomy.Version() || !reflect.DeepEqual(p.Keys, expected[i].Keys) {
					report.Membership++
				}
				if p.Primary != expected[i].Primary {
					report.Primary++
				}
				if !reflect.DeepEqual(p.Related, expected[i].Related) {
					report.Related++
				}
			}
			if docs[i].Err() == redis.Nil {
				report.Documents++
			} else if docs[i].Err() != nil {
				return report, docs[i].Err()
			} else {
				var actual domain.Job
				if json.Unmarshal([]byte(docs[i].Val()), &actual) != nil {
					report.Documents++
				} else {
					raw, _ := json.Marshal(j)
					actualRaw, _ := json.Marshal(actual)
					if string(raw) != string(actualRaw) {
						report.Documents++
					}
				}
			}
			for n, c := range checks[i] {
				if !c.Val() {
					if n == 0 {
						report.Missing++
					} else {
						report.Membership++
					}
				}
			}
		}
		after = jobs[len(jobs)-1].ID
	}
	indexCount, err := manager.RDB.ZCount(ctx, prefix+"expires", fmt.Sprint(at.Unix()+1), "+inf").Result()
	if err != nil {
		return report, err
	}
	if indexCount != int64(report.Active) {
		report.Counts++
	}
	// Includes global Set, so stale records without any family are found too.
	sets := []string{"index"}
	for _, f := range taxonomy.Families() {
		for _, kind := range []string{"family:", "family:primary:", "family:related:"} {
			sets = append(sets, kind+f.ID)
		}
	}
	for _, key := range sets {
		var cursor uint64
		for {
			ids, next, e := manager.RDB.SScan(ctx, prefix+key, cursor, "*", int64(size)).Result()
			if e != nil {
				return report, e
			}
			cursor = next
			// COUNT is only a hint; cap downstream SQL/Redis work explicitly.
			for start := 0; start < len(ids); start += size {
				end := min(start+size, len(ids))
				chunk := ids[start:end]
				jobs, e := source.GetByIDs(ctx, chunk)
				if e != nil {
					return report, e
				}
				found := map[string]domain.Job{}
				for _, j := range jobs {
					found[j.ID] = j
				}
				for _, id := range chunk {
					j, ok := found[id]
					if !ok {
						report.Stale++
						continue
					}
					if key == "index" {
						continue
					}
					plan, e := jobindex.Build(j, keys(j))
					if e != nil {
						report.Invalid++
						continue
					}
					belongs := false
					for _, k := range plan.Keys {
						if k == key {
							belongs = true
						}
					}
					if !belongs {
						if strings.HasPrefix(key, "family:primary:") {
							report.Primary++
						} else if strings.HasPrefix(key, "family:related:") {
							report.Related++
						} else {
							report.Any++
						}
					}
				}
			}
			if cursor == 0 {
				break
			}
		}
	}
	var cursor uint64
	for {
		registered, next, e := manager.RDB.SScan(ctx, prefix+"keys", cursor, "*", int64(size)).Result()
		if e != nil {
			return report, e
		}
		for _, k := range registered {
			suffix := strings.TrimPrefix(k, prefix)
			if strings.HasPrefix(suffix, "family:") {
				f := strings.TrimPrefix(suffix, "family:")
				f = strings.TrimPrefix(f, "primary:")
				f = strings.TrimPrefix(f, "related:")
				if !taxonomy.IsPublic(f) {
					report.Invalid++
				}
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	// Detect unknown family keys even if created outside the managed manifest.
	cursor = 0
	for {
		names, next, e := manager.RDB.Scan(ctx, cursor, prefix+"family:*", int64(size)).Result()
		if e != nil {
			return report, e
		}
		for _, name := range names {
			family := strings.TrimPrefix(name, prefix+"family:")
			family = strings.TrimPrefix(family, "primary:")
			family = strings.TrimPrefix(family, "related:")
			if !taxonomy.IsPublic(family) {
				report.Invalid++
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}

	return report, nil
}

// Cleanup never uses KEYS and never deletes an active namespace. The previous
// version is retained until an operator explicitly selects it for cleanup.
func (m *Maintenance) Cleanup(ctx context.Context, version string) error {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return err
	}
	defer release()
	if !strings.HasPrefix(version, "v2-") && version != jobindex.Bootstrap {
		return fmt.Errorf("invalid cleanup namespace")
	}
	prefix := jobindex.Prefix(version)
	var cursor uint64
	for {
		keys, next, err := m.Index.RDB.SScan(ctx, prefix+"keys", cursor, "*", int64(m.size())).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			if !strings.HasPrefix(key, prefix) {
				return fmt.Errorf("namespace manifest contains external key")
			}
		}
		if len(keys) > 0 {
			args := []any{version}
			for _, key := range keys {
				args = append(args, key)
			}
			if _, err = cleanup.Run(ctx, m.Index.RDB, []string{jobindex.ActiveKey}, args...).Result(); err != nil {
				return err
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	_, err = cleanup.Run(ctx, m.Index.RDB, []string{jobindex.ActiveKey}, version, prefix+"keys").Result()
	return err
}

var cleanup = redis.NewScript(`if (redis.call('GET',KEYS[1]) or 'bootstrap')==ARGV[1] then return redis.error_reply('cannot clean active namespace') end;for i=2,#ARGV do redis.call('DEL',ARGV[i]) end;return 1`)

// Backfill uses SCAN of document keys, pipelined GET/PTTL and SQL batch import.
// It does not renew old TTLs or overwrite a row already present in PostgreSQL.
func (m *Maintenance) Backfill(ctx context.Context) (int, int, error) {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return 0, 0, err
	}
	defer release()
	total, invalid := 0, 0
	var cursor uint64
	for {
		names, next, e := m.Index.RDB.Scan(ctx, cursor, "scraper:job:*", int64(m.size())).Result()
		if e != nil {
			return total, invalid, e
		}
		cursor = next
		for start := 0; start < len(names); start += m.size() {
			end := min(start+m.size(), len(names))
			chunk := names[start:end]
			pipe := m.Index.RDB.Pipeline()
			raws := map[string]*redis.StringCmd{}
			ttls := map[string]*redis.DurationCmd{}
			for _, key := range chunk {
				if strings.HasSuffix(key, ":idx") {
					continue
				}
				raws[key] = pipe.Get(ctx, key)
				ttls[key] = pipe.PTTL(ctx, key)
			}
			if _, e = pipe.Exec(ctx); e != nil && e != redis.Nil {
				return total, invalid, e
			}
			jobs := []domain.Job{}
			for key, raw := range raws {
				var j domain.Job
				if raw.Err() != nil || json.Unmarshal([]byte(raw.Val()), &j) != nil || j.ID != strings.TrimPrefix(key, "scraper:job:") || ttls[key].Val() <= 0 {
					invalid++
					continue
				}
				if c := j.Classification; c != nil {
					c.PrimaryFamily = taxonomy.Normalize(c.PrimaryFamily)
					if c.PrimaryFamily == "" {
						invalid++
						continue
					}
					valid := true
					for _, f := range c.RelatedFamilies {
						if !taxonomy.IsPublic(taxonomy.Normalize(f)) {
							valid = false
						}
					}
					if !valid {
						invalid++
						continue
					}
					c.RelatedFamilies = taxonomy.Related(c.PrimaryFamily, c.RelatedFamilies)
				}
				j.CatalogExpiresAt = m.Store.Now().Add(ttls[key].Val())
				jobs = append(jobs, j)
			}
			result, e := m.Store.Import(ctx, jobs)
			if e != nil {
				return total, invalid, e
			}
			total += len(result.Persisted)
			invalid += result.Invalid
			slog.Info("catalog backfill batch", "batch_size", len(jobs), "inserted", len(result.Persisted), "invalid", invalid)
		}
		if cursor == 0 {
			break
		}
	}
	if _, err = m.rebuildLocked(ctx); err != nil {
		return total, invalid, err
	}
	return total, invalid, nil
}

// Expire applies committed PostgreSQL expirations in bounded batches. It never
// deletes historical SQL rows, and repeated runs do not bump cache generation.
func (m *Maintenance) Expire(ctx context.Context) (int, error) {
	release, err := m.Store.ProcessingLease(ctx)
	if err != nil {
		return 0, err
	}
	defer release()
	after := ""
	at := m.Store.Now()
	changed := 0
	for {
		jobs, e := m.Store.InactiveBatch(ctx, after, m.size(), at)
		if e != nil {
			return changed, e
		}
		if len(jobs) == 0 {
			break
		}
		// Ignore archived rows that are already absent from the active projection.
		// This also keeps an invalid historical classification from blocking
		// collection after an explicitly repaired/rebuilt namespace.
		version, e := m.Index.Active(ctx)
		if e != nil {
			return changed, e
		}
		pipe := m.Index.RDB.Pipeline()
		members := make([]*redis.BoolCmd, len(jobs))
		for i, j := range jobs {
			members[i] = pipe.SIsMember(ctx, jobindex.Prefix(version)+"index", j.ID)
		}
		if _, e = pipe.Exec(ctx); e != nil {
			return changed, e
		}
		indexed := []domain.Job{}
		for i, j := range jobs {
			if members[i].Val() {
				indexed = append(indexed, j)
			}
		}
		n, e := m.Index.Apply(ctx, indexed, m.keys)
		if e != nil {
			return changed, e
		}

		changed += n
		after = jobs[len(jobs)-1].ID
	}
	slog.Info("catalog expiration complete", "changed", changed, "batch_size", m.size())
	return changed, nil
}

// Reclassify is explicit, independent of external collection, and never renews
// lastSeenAt/expiresAt. Its exclusive fence prevents stale payload overwrites.
func (m *Maintenance) Reclassify(ctx context.Context) (int, error) {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return 0, err
	}
	defer release()
	after := ""
	at := m.Store.Now()
	changed := 0
	for {
		jobs, e := m.Store.Batch(ctx, after, m.size(), at)
		if e != nil {
			return changed, e
		}
		if len(jobs) == 0 {
			break
		}
		cursor := jobs[len(jobs)-1].ID
		updates := []domain.Job{}
		for _, j := range jobs {
			classification := classifier.Classify(j)
			oldClassification, _ := json.Marshal(j.Classification)
			newClassification, _ := json.Marshal(classification)
			if string(oldClassification) != string(newClassification) {
				j.Classification = &classification
				updates = append(updates, j)
			}
		}
		persisted, e := m.Store.ReclassifyBatch(ctx, updates)
		if e != nil {
			return changed, e
		}
		byID := map[string]domain.Job{}
		for _, j := range persisted {
			byID[j.ID] = j
		}
		for i, j := range jobs {
			if update, ok := byID[j.ID]; ok {
				jobs[i] = update
			}
		}
		if _, e = m.Index.Apply(ctx, jobs, m.keys); e != nil {
			return changed, e
		}
		if e = m.Store.MarkIndexed(ctx, jobs); e != nil {
			return changed, e
		}
		changed += len(persisted)
		after = cursor
		slog.Info("catalog reclassification batch", "batch_size", len(jobs), "changed", len(persisted))
	}
	return changed, nil
}

// Rollback only activates an already existing namespace if it still matches
// the PostgreSQL truth. Changed catalog rows require a new rebuild instead.
func (m *Maintenance) Rollback(ctx context.Context, version string) error {
	release, err := m.Store.MaintenanceLease(ctx)
	if err != nil {
		return err
	}
	defer release()
	if version == "" {
		version, err = m.Index.RDB.Get(ctx, "scraper:jobs:previous-index-version").Result()
		if err != nil {
			return err
		}
	}
	if !strings.HasPrefix(version, "v2-") && version != jobindex.Bootstrap {
		return fmt.Errorf("invalid rollback namespace")
	}
	if m.Index.RDB.Exists(ctx, jobindex.Prefix(version)+"keys").Val() == 0 {
		return fmt.Errorf("rollback namespace absent")
	}
	report, err := Compare(ctx, m.Store, m.Index, version, m.size(), m.keys)
	if err != nil {
		return err
	}
	if report.Divergent() {
		return fmt.Errorf("rollback namespace diverges from PostgreSQL; rebuild required")
	}
	previous, err := m.Index.Active(ctx)
	if err != nil {
		return err
	}
	familyKeys := []string{}
	for _, f := range taxonomy.Families() {
		for _, kind := range []string{"family:", "family:primary:", "family:related:"} {
			familyKeys = append(familyKeys, kind+f.ID)
		}
	}
	raw, _ := json.Marshal(familyKeys)
	_, err = publish.Run(ctx, m.Index.RDB, []string{jobindex.ActiveKey, jobindex.GenerationKey}, previous, version, jobindex.Prefix(version), string(raw)).Result()
	return err
}
