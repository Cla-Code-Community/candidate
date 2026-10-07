package catalogops

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalog"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"os"
	"strings"
	"testing"
	"time"
)

func integration(t *testing.T) (*Maintenance, *redis.Client) {
	t.Helper()
	dsn := os.Getenv("PAV125_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("PAV125_TEST_DATABASE_URL not set (isolated PostgreSQL required)")
	}
	root, e := sql.Open("postgres", dsn)
	require.NoError(t, e)
	schema := fmt.Sprintf("pav125_%d", time.Now().UnixNano())
	_, e = root.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, e)
	db, e := sql.Open("postgres", dsn+"&search_path="+schema)
	require.NoError(t, e)
	migration, e := os.ReadFile("../../../backend/drizzle/0015_job_catalog.sql")
	require.NoError(t, e)
	_, e = db.Exec(string(migration))
	require.NoError(t, e)
	t.Cleanup(func() { db.Close(); root.Exec(`DROP SCHEMA ` + schema + ` CASCADE`); root.Close() })
	mr := miniredis.RunT(t)
	r := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { r.Close() })
	store := catalog.New(db, catalog.DefaultLifetime)
	now := time.Now().UTC().Truncate(time.Second)
	store.Now = func() time.Time { return now }
	index := jobindex.New(r)
	index.Now = func() time.Time { return store.Now() }
	return &Maintenance{Store: store, Index: index, BatchSize: 2}, r
}
func identity(id string) string { j := sample(id, "backend"); return jobstore.StableID(&j) }
func sample(id, family string) domain.Job {
	return domain.Job{ID: id, Title: "Job " + id, URL: "https://example.test/" + id, Source: "test", Keyword: "sql", Classification: &domain.Classification{PrimaryFamily: family, RelatedFamilies: []string{"platform"}, InScope: true}}
}
func TestCatalogInsertUpsertCycleAndCommit(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	first := m.Store.Now()
	result, e := m.Store.SaveBatch(ctx, []domain.Job{sample("a", "product"), sample("b", "product_design"), sample("a", "product")})
	require.NoError(t, e)
	require.Len(t, result.Persisted, 2)
	require.Equal(t, 2, result.Inserted)
	require.Equal(t, int64(0), r.Exists(ctx, "scraper:jobs:index").Val())
	_, e = m.Index.Apply(ctx, result.Persisted, m.keys)
	require.NoError(t, e)
	require.NoError(t, m.Store.MarkIndexed(ctx, result.Persisted))
	m.Store.Now = func() time.Time { return first.Add(24 * time.Hour) }
	updated := sample("a", "product_design")
	updated.Source = "second"
	result, e = m.Store.SaveBatch(ctx, []domain.Job{updated})
	require.NoError(t, e)
	require.Equal(t, 1, result.Updated)
	require.WithinDuration(t, first.Add(24*time.Hour).Add(catalog.DefaultLifetime), result.Persisted[0].CatalogExpiresAt, time.Microsecond)
	_, e = m.Index.Apply(ctx, result.Persisted, m.keys)
	require.NoError(t, e)
	require.False(t, r.SIsMember(ctx, "scraper:jobs:family:primary:product", identity("a")).Val())
	require.True(t, r.SIsMember(ctx, "scraper:jobs:family:primary:product_design", identity("a")).Val())
	var count int
	require.NoError(t, m.Store.DB.QueryRow("SELECT count(*) FROM job_catalog").Scan(&count))
	require.Equal(t, 2, count)
	var seen, last time.Time
	require.NoError(t, m.Store.DB.QueryRow("SELECT first_seen_at,last_seen_at FROM job_catalog WHERE id=$1", identity("a")).Scan(&seen, &last))
	require.WithinDuration(t, first, seen, time.Microsecond)
	require.WithinDuration(t, m.Store.Now(), last, time.Microsecond)
	m.Store.Now = func() time.Time { return first.Add(10 * 24 * time.Hour) }
	jobs, e := m.Store.GetByIDs(ctx, []string{identity("a"), identity("b")})
	require.NoError(t, e)
	require.Empty(t, jobs)
	require.NoError(t, m.Store.DB.QueryRow("SELECT count(*) FROM job_catalog").Scan(&count))
	require.Equal(t, 2, count)
	n, e := m.Expire(ctx)
	require.NoError(t, e)
	require.Equal(t, 2, n)
	require.Zero(t, r.SCard(ctx, "scraper:jobs:index").Val())
	again, e := m.Expire(ctx)
	require.NoError(t, e)
	require.Zero(t, again)
	v, e := m.Rebuild(ctx)
	require.NoError(t, e)
	require.Zero(t, r.SCard(ctx, jobindex.Prefix(v)+"index").Val())
}
func TestCatalogRollbackAndCommitFailure(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	_, e := m.Store.DB.Exec(`ALTER TABLE job_catalog ADD CONSTRAINT fail_batch CHECK (payload->>'title' <> 'fail')`)
	require.NoError(t, e)
	bad := sample("bad", "product")
	bad.Title = "fail"
	result, e := m.Store.SaveBatch(ctx, []domain.Job{sample("ok", "backend"), bad})
	require.Error(t, e)
	require.Empty(t, result.Persisted)
	n, e := m.Store.Count(ctx)
	require.NoError(t, e)
	require.Zero(t, n)
	require.Zero(t, r.SCard(ctx, "scraper:jobs:index").Val())
	_, e = m.Store.DB.Exec(`CREATE FUNCTION fail_commit() RETURNS trigger AS $$ BEGIN IF NEW.payload->>'title'='commitfail' THEN RAISE EXCEPTION 'forced deferred commit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON job_catalog DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_commit();`)
	require.NoError(t, e)
	bad.Title = "commitfail"
	result, e = m.Store.SaveBatch(ctx, []domain.Job{sample("ok", "backend"), bad})
	require.ErrorContains(t, e, "catalog commit")
	require.Empty(t, result.Persisted)
	n, e = m.Store.Count(ctx)
	require.NoError(t, e)
	require.Zero(t, n)
	require.Zero(t, r.SCard(ctx, "scraper:jobs:index").Val())
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, e = m.Store.SaveBatch(canceled, []domain.Job{sample("cancel", "backend")})
	require.Error(t, e)
}
func TestRebuildReconcileAndControlledCleanup(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	_, e := m.Store.SaveBatch(ctx, []domain.Job{sample("a", "backend"), sample("b", "product"), sample("c", "product_design")})
	require.NoError(t, e)
	r.Set(ctx, "session:external", "keep", 0)
	v, e := m.Rebuild(ctx)
	require.NoError(t, e)
	require.True(t, strings.HasPrefix(v, "v2-"))
	require.Equal(t, v, r.Get(ctx, jobindex.ActiveKey).Val())
	before := r.Get(ctx, jobindex.GenerationKey).Val()
	report, e := m.Reconcile(ctx, false)
	require.NoError(t, e)
	require.False(t, report.Divergent(), fmt.Sprint(report))
	require.Equal(t, 3, report.Active)
	var pending int
	require.NoError(t, m.Store.DB.QueryRow("SELECT count(*) FROM job_catalog WHERE indexed_revision<revision").Scan(&pending))
	require.Zero(t, pending)
	prefix := jobindex.Prefix(v)
	r.SRem(ctx, prefix+"family:primary:backend", identity("a"))
	r.SAdd(ctx, prefix+"family:product", "ghost")
	r.SAdd(ctx, prefix+"family:related:backend", identity("b"))
	r.Set(ctx, prefix+"index-membership:"+identity("b"), "{}", 0)
	report, e = m.Reconcile(ctx, false)
	require.NoError(t, e)
	require.True(t, report.Divergent())
	require.Positive(t, report.Stale)
	require.Positive(t, report.Membership)
	require.Positive(t, report.Related)
	require.Equal(t, before, r.Get(ctx, jobindex.GenerationKey).Val())
	require.Equal(t, v, r.Get(ctx, jobindex.ActiveKey).Val())
	_, e = m.Reconcile(ctx, true)
	require.NoError(t, e)
	current := r.Get(ctx, jobindex.ActiveKey).Val()
	require.NotEqual(t, v, current)
	report, e = m.Reconcile(ctx, false)
	require.NoError(t, e)
	require.False(t, report.Divergent(), fmt.Sprint(report))
	require.Error(t, m.Rollback(ctx, v)) // the deliberately corrupted old namespace is not safe to activate
	require.Error(t, m.Cleanup(ctx, current))
	require.NoError(t, m.Cleanup(ctx, v))
	require.Equal(t, "keep", r.Get(ctx, "session:external").Val())
	require.Error(t, m.Cleanup(ctx, "unrelated"))
	bad := sample("bad", "finance")
	_, e = m.Store.SaveBatch(ctx, []domain.Job{bad})
	require.NoError(t, e)
	_, e = m.Rebuild(ctx)
	require.Error(t, e)
	require.Equal(t, current, r.Get(ctx, jobindex.ActiveKey).Val())
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, e = m.Rebuild(canceled)
	require.Error(t, e)
}
func TestBackfillIdempotentPreservesTTLAndInvalid(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	first := m.Store.Now()
	for _, id := range []string{"a", "b", "c"} {
		j := sample(id, "product")
		j.ID = id
		raw, e := json.Marshal(j)
		require.NoError(t, e)
		r.Set(ctx, "scraper:job:"+id, raw, 48*time.Hour)
	}
	r.Set(ctx, "scraper:job:invalid", "not json", time.Hour)
	r.Set(ctx, "scraper:job:no-ttl", `{"id":"no-ttl"}`, 0)
	n, invalid, e := m.Backfill(ctx)
	require.NoError(t, e)
	require.Equal(t, 3, n)
	require.Equal(t, 2, invalid)
	jobs, e := m.Store.GetByIDs(ctx, []string{"a"})
	require.NoError(t, e)
	require.Len(t, jobs, 1)
	require.WithinDuration(t, first.Add(48*time.Hour), jobs[0].CatalogExpiresAt, time.Second)
	n, _, e = m.Backfill(ctx)
	require.NoError(t, e)
	require.Zero(t, n)
	count, e := m.Store.Count(ctx)
	require.NoError(t, e)
	require.Equal(t, int64(3), count)
	report, e := m.Reconcile(ctx, false)
	require.NoError(t, e)
	require.False(t, report.Divergent(), fmt.Sprint(report))
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	_, _, e = m.Backfill(canceled)
	require.Error(t, e)
}

func TestReclassifyPreservesLifecycleAndRepairsRetry(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	j := sample("a", "other")
	j.Title = "Product Manager"
	j.Description = "Product discovery roadmap backlog strategy stakeholders"
	result, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	id := result.Persisted[0].ID
	expiry := result.Persisted[0].CatalogExpiresAt
	_, e = m.Index.Apply(ctx, result.Persisted, m.keys)
	require.NoError(t, e)
	n, e := m.Reclassify(ctx)
	require.NoError(t, e)
	require.Equal(t, 1, n)
	jobs, e := m.Store.GetByIDs(ctx, []string{id})
	require.NoError(t, e)
	require.Equal(t, "product", jobs[0].Classification.PrimaryFamily)
	require.True(t, expiry.Equal(jobs[0].CatalogExpiresAt))
	require.True(t, r.SIsMember(ctx, "scraper:jobs:family:primary:product", id).Val())
	before := r.Get(ctx, jobindex.GenerationKey).Val()
	n, e = m.Reclassify(ctx)
	require.NoError(t, e)
	require.Zero(t, n)
	require.Equal(t, before, r.Get(ctx, jobindex.GenerationKey).Val())
	// Deactivation is a committed historical record, with active membership removed.
	tombstones, e := m.Store.Deactivate(ctx, []string{id})
	require.NoError(t, e)
	_, e = m.Index.Apply(ctx, tombstones, m.keys)
	require.NoError(t, e)
	require.False(t, r.SIsMember(ctx, "scraper:jobs:family:product", id).Val())
	active, e := m.Store.Count(ctx)
	require.NoError(t, e)
	require.Zero(t, active)
	var retained int
	require.NoError(t, m.Store.DB.QueryRow("SELECT count(*) FROM job_catalog").Scan(&retained))
	require.Equal(t, 1, retained)
}

func TestValidatedNamespaceRollback(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	_, e := m.Store.SaveBatch(ctx, []domain.Job{sample("a", "product")})
	require.NoError(t, e)
	first, e := m.Rebuild(ctx)
	require.NoError(t, e)
	second, e := m.Rebuild(ctx)
	require.NoError(t, e)
	require.NotEqual(t, first, second)
	require.NoError(t, m.Rollback(ctx, first))
	require.Equal(t, first, r.Get(ctx, jobindex.ActiveKey).Val())
	_, e = m.Store.SaveBatch(ctx, []domain.Job{sample("b", "backend")})
	require.NoError(t, e)
	require.Error(t, m.Rollback(ctx, second))
	require.Equal(t, first, r.Get(ctx, jobindex.ActiveKey).Val())
}

func TestReadOnlyCatalogStreamCountAndLimit(t *testing.T) {
	m, _ := integration(t)
	ctx := context.Background()
	_, e := m.Store.SaveBatch(ctx, []domain.Job{sample("a", "backend"), sample("b", "product"), sample("c", "product_design")})
	require.NoError(t, e)
	for _, limit := range []int{0, 2} {
		count := 0
		var total int64
		e = m.Store.StreamActive(ctx, limit, func(n int64) error { total = n; return nil }, func(domain.Job) error { count++; return nil })
		require.NoError(t, e)
		require.Equal(t, int64(3), total)
		if limit == 0 {
			require.Equal(t, 3, count)
		} else {
			require.Equal(t, limit, count)
		}
	}
	canceled, cancel := context.WithCancel(ctx)
	cancel()
	require.Error(t, m.Store.StreamActive(canceled, 0, func(int64) error { return nil }, func(domain.Job) error { return nil }))
}
