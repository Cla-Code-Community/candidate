// Package jobindex owns versioned Valkey projections of committed catalog jobs.
package jobindex

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/redis/go-redis/v9"
)

const ActiveKey = "scraper:jobs:index-version"
const GenerationKey = "jobs:search:generation"
const Bootstrap = "bootstrap"

func Prefix(version string) string { return "scraper:jobs:ns:" + version + ":" }

type Plan struct {
	Change   string   `json:"change,omitempty"`
	ID       string   `json:"id"`
	Revision int64    `json:"revision"`
	Expires  int64    `json:"expiresAt"`
	Taxonomy string   `json:"taxonomyVersion"`
	Primary  string   `json:"primaryFamily"`
	Related  []string `json:"relatedFamilies"`
	Keys     []string `json:"keys"`
	Metadata string   `json:"metadata,omitempty"`
	Document string   `json:"document,omitempty"`
}

func Build(job domain.Job, keys []string) (Plan, error) {
	if job.ID == "" || job.CatalogRevision < 1 || job.CatalogExpiresAt.IsZero() {
		return Plan{}, fmt.Errorf("index requires committed catalog identity, revision and expiry")
	}
	change := job.CatalogChange
	switch change {
	case "job_created", "job_updated", "job_removed", "job_reclassified":
	default:
		change = "job_updated"
	}
	p := Plan{Change: change, ID: job.ID, Revision: job.CatalogRevision, Expires: job.CatalogExpiresAt.Unix(), Taxonomy: taxonomy.Version(), Keys: []string{}, Related: []string{}}
	if c := job.Classification; c != nil {
		if c.PrimaryFamily != "other" && !taxonomy.IsPublic(c.PrimaryFamily) {
			return p, fmt.Errorf("invalid primary family in committed classification")
		}
		p.Primary = c.PrimaryFamily
		for _, f := range c.RelatedFamilies {
			if !taxonomy.IsPublic(f) {
				return p, fmt.Errorf("invalid related family in committed classification")
			}
		}
		p.Related = taxonomy.Related(c.PrimaryFamily, c.RelatedFamilies)
	}
	set := map[string]bool{}
	for _, k := range keys {
		if !strings.HasPrefix(k, "scraper:jobs:") {
			return p, fmt.Errorf("invalid index key")
		}
		set[strings.TrimPrefix(k, "scraper:jobs:")] = true
	}
	if taxonomy.IsPublic(p.Primary) {
		set["family:"+p.Primary] = true
		set["family:primary:"+p.Primary] = true
	}
	for _, f := range p.Related {
		set["family:"+f] = true
		set["family:related:"+f] = true
	}
	// Family IDs are never normalized into labels/space-separated keys.
	for k := range set {
		if strings.HasPrefix(k, "family:") {
			f := strings.TrimPrefix(k, "family:")
			f = strings.TrimPrefix(f, "primary:")
			f = strings.TrimPrefix(f, "related:")
			if !taxonomy.IsPublic(f) {
				return p, fmt.Errorf("unknown controlled family index")
			}
		}
	}
	for k := range set {
		p.Keys = append(p.Keys, k)
	}
	sort.Strings(p.Keys)
	raw, err := json.Marshal(job)
	p.Document = string(raw)
	return p, err
}

type Manager struct {
	RDB *redis.Client
	Now func() time.Time
}

func New(rdb *redis.Client) *Manager { return &Manager{RDB: rdb, Now: time.Now} }
func (m *Manager) Active(ctx context.Context) (string, error) {
	v, e := m.RDB.Get(ctx, ActiveKey).Result()
	if e == redis.Nil {
		return Bootstrap, nil
	}
	return v, e
}
func (m *Manager) Apply(ctx context.Context, jobs []domain.Job, keys func(domain.Job) []string) (int, error) {
	started := time.Now()
	version, err := m.Active(ctx)
	if err != nil {
		metrics.ObserveIndex(started, len(jobs), 0, err)
		return 0, err
	}
	return m.ApplyVersion(ctx, version, jobs, keys, false)
}
func (m *Manager) ApplyVersion(ctx context.Context, version string, jobs []domain.Job, keys func(domain.Job) []string, draft bool) (changed int, returnErr error) {
	started := time.Now()
	defer func() { metrics.ObserveIndex(started, len(jobs), changed, returnErr) }()
	if len(jobs) > 2500 {
		return 0, fmt.Errorf("index batch exceeds 2500")
	}
	if len(jobs) == 0 {
		return 0, nil
	}
	now := m.Now().Unix()
	plans := make([]Plan, 0, len(jobs))
	seen := map[string]bool{}
	for _, j := range jobs {
		if seen[j.ID] {
			return 0, fmt.Errorf("duplicate ID in index batch")
		}
		seen[j.ID] = true
		p, e := Build(j, keys(j))
		if e != nil {
			return 0, e
		}
		if p.Expires <= now {
			p.Keys = []string{}
			p.Related = []string{}
		}
		meta := p
		meta.Document = ""
		encoded, e := json.Marshal(meta)
		if e != nil {
			return 0, e
		}
		p.Metadata = string(encoded)
		plans = append(plans, p)
	}
	raw, err := json.Marshal(plans)
	if err != nil {
		return 0, err
	}
	scriptStarted := time.Now()
	result, err := applyScript.Run(ctx, m.RDB, []string{ActiveKey, GenerationKey}, version, Prefix(version), string(raw), now, draft).Int()
	if err != nil {
		return 0, fmt.Errorf("atomic index batch: %w", err)
	}

	if !draft && result > 0 {
		metrics.CacheInvalidationDuration.WithLabelValues("invalidate").Observe(time.Since(scriptStarted).Seconds())
	}
	return result, nil
}

// Preflight validates every key type before any mutation: Redis Lua errors do
// not roll back previous writes. All removals are SREM of this stable job ID.
// Revision fencing makes retries and out-of-order reclassification idempotent.
var applyScript = redis.NewScript(`
local version,prefix,plans,now,draft=ARGV[1],ARGV[2],cjson.decode(ARGV[3]),tonumber(ARGV[4]),ARGV[5]=='1'
local function typed(k,want)
 local t=redis.call('TYPE',k).ok
 if t~='none' and t~=want then error('WRONGTYPE controlled index preflight') end
end
typed(KEYS[1],'string');typed(KEYS[2],'string');typed('scraper:jobs:taxonomy-version','string')
local telemetryType=redis.call('TYPE','scraper:observability:maintenance-metrics').ok;local telemetryOk=telemetryType=='none' or telemetryType=='hash'
if telemetryOk then for _,reason in ipairs({'job_created','job_updated','job_removed','job_reclassified','index_rebuilt','taxonomy_changed'}) do local v=redis.call('HGET','scraper:observability:maintenance-metrics','cache:'..reason);if v and (not string.match(v,'^%d+$') or tonumber(v)>=9007199254740991) then telemetryOk=false end end end
local g=redis.call('GET',KEYS[2]);if g and (not string.match(g,'^%d+$') or tonumber(g)>=9007199254740991) then error('invalid generation') end
local active=redis.call('GET',KEYS[1]) or 'bootstrap'
if not draft and active~=version then return redis.error_reply('index version changed') end
typed(prefix..'index','set');typed(prefix..'expires','zset');typed(prefix..'keys','set')
if not draft then typed('scraper:jobs:index','set');typed('scraper:jobs:expires','zset') end
local old={}
for i,p in ipairs(plans) do
 local meta=prefix..'index-membership:'..p.id
 typed(meta,'string');typed(prefix..'job:'..p.id,'string')
 local raw=redis.call('GET',meta)
 old[i]=raw and cjson.decode(raw) or {revision=0,keys={}}
 if type(old[i])~='table' or not tonumber(old[i].revision) or tonumber(old[i].revision)<0 or type(old[i].keys)~='table' then error('invalid index membership') end
 for k,v in pairs(old[i].keys) do if type(k)~='number' or type(v)~='string' or k<1 or k>#old[i].keys then error('invalid index membership keys') end end
 if not draft and not raw then
  typed('scraper:job:'..p.id..':idx','set')
  local legacy=redis.call('SMEMBERS','scraper:job:'..p.id..':idx')
  for _,key in ipairs(legacy) do
   if string.sub(key,1,13)=='scraper:jobs:' then table.insert(old[i].keys,string.sub(key,14)) end
  end
 end
 for _,k in ipairs(old[i].keys) do typed(prefix..k,'set');if not draft then typed('scraper:jobs:'..k,'set') end end
 for _,k in ipairs(p.keys) do typed(prefix..k,'set');if not draft then typed('scraper:jobs:'..k,'set') end end
 if not draft then typed('scraper:job:'..p.id,'string');typed('scraper:jobs:index-membership:'..p.id,'string');typed('scraper:job:'..p.id..':idx','set') end
end
local changed=0;local invalidations={}
for i,p in ipairs(plans) do
 if tonumber(old[i].revision)<tonumber(p.revision) or (tonumber(old[i].revision)==tonumber(p.revision) and p.expiresAt<=now and (#old[i].keys>0 or redis.call('SISMEMBER',prefix..'index',p.id)==1)) then
  for _,k in ipairs(old[i].keys) do
   redis.call('SREM',prefix..k,p.id)
   if not draft then redis.call('SREM','scraper:jobs:'..k,p.id) end
  end
  local alive=p.expiresAt>now
  if alive then
   for _,k in ipairs(p.keys) do
    redis.call('SADD',prefix..k,p.id);redis.call('SADD',prefix..'keys',prefix..k)
    if not draft then redis.call('SADD','scraper:jobs:'..k,p.id) end
   end
   redis.call('SADD',prefix..'index',p.id);redis.call('ZADD',prefix..'expires',p.expiresAt,p.id)
   redis.call('SET',prefix..'job:'..p.id,p.document,'EX',math.max(1,p.expiresAt-now))
  else
   p.keys={};p.relatedFamilies={}
   redis.call('SREM',prefix..'index',p.id);redis.call('ZREM',prefix..'expires',p.id);redis.call('DEL',prefix..'job:'..p.id)
  end
  local metadata=p.metadata
  redis.call('SET',prefix..'index-membership:'..p.id,metadata)
  redis.call('SADD',prefix..'keys',prefix..'index-membership:'..p.id,prefix..'job:'..p.id,prefix..'index',prefix..'expires')
  if not draft then
   if alive then
    redis.call('SADD','scraper:jobs:index',p.id);redis.call('ZADD','scraper:jobs:expires',p.expiresAt,p.id)
    redis.call('SET','scraper:job:'..p.id,redis.call('GET',prefix..'job:'..p.id),'EX',math.max(1,p.expiresAt-now))
   else redis.call('SREM','scraper:jobs:index',p.id);redis.call('ZREM','scraper:jobs:expires',p.id);redis.call('DEL','scraper:job:'..p.id) end
   redis.call('SET','scraper:jobs:index-membership:'..p.id,metadata)
   redis.call('DEL','scraper:job:'..p.id..':idx')
   for _,k in ipairs(p.keys) do redis.call('SADD','scraper:job:'..p.id..':idx','scraper:jobs:'..k) end
  end
  if draft then
   local ttl=math.max(1,p.expiresAt-now)
   local function extend(k) local oldttl=redis.call('TTL',k);if oldttl<ttl then redis.call('EXPIRE',k,ttl) end end
   for _,k in ipairs(p.keys) do extend(prefix..k) end
   extend(prefix..'index');extend(prefix..'expires');extend(prefix..'keys');extend(prefix..'index-membership:'..p.id)
  else
   redis.call('PERSIST',prefix..'index');redis.call('PERSIST',prefix..'expires');redis.call('PERSIST',prefix..'keys')
   for _,k in ipairs(p.keys) do redis.call('PERSIST',prefix..k) end
  end
  changed=changed+1
  if not draft then local reason=p.change;if not alive then reason='job_removed' end;invalidations[reason]=true end
 end
end
if not draft and changed>0 then redis.call('SET',KEYS[1],version);redis.call('INCR',KEYS[2]);if telemetryOk then for reason,_ in pairs(invalidations) do redis.call('HINCRBY','scraper:observability:maintenance-metrics','cache:'..reason,1) end end;local old=redis.call('GET','scraper:jobs:taxonomy-version');local tax=plans[1].taxonomyVersion;if telemetryOk and old and old~=tax then redis.call('HINCRBY','scraper:observability:maintenance-metrics','cache:taxonomy_changed',1) end;redis.call('SET','scraper:jobs:taxonomy-version',tax) end
return changed
`)
