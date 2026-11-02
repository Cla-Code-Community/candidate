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
	"sync"
	"testing"
	"time"
)

func integration(t testing.TB) (*Maintenance, *redis.Client) {
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
	mr, e := miniredis.Run()
	require.NoError(t, e)
	t.Cleanup(mr.Close)
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

func TestCatalogContentOutcomesAndRefreshRecovery(t *testing.T) {
	m, r := integration(t)
	ctx := context.Background()
	first := m.Store.Now()
	j := sample("outcomes", "backend")
	j.Company = "Company"
	j.Location = "São Paulo"
	j.Sources = []string{"test"}
	j.Keywords = []string{"sql"}
	j.Description = strings.Repeat("description ", 400)
	created, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	require.Equal(t, 1, created.Inserted)
	require.True(t, created.ContentChangeDetectionAvailable)
	old := created.Persisted[0]
	require.Equal(t, "job_created", old.CatalogChange)
	_, e = m.Index.Apply(ctx, created.Persisted, m.keys)
	require.NoError(t, e)
	require.NoError(t, m.Store.MarkIndexed(ctx, created.Persisted))
	// Column-target trigger proves refresh never assigns payload, even an equal value.
	_, e = m.Store.DB.Exec(`CREATE FUNCTION forbid_payload() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'payload assigned'; END; $$ LANGUAGE plpgsql; CREATE TRIGGER forbid_payload BEFORE UPDATE OF payload ON job_catalog FOR EACH ROW EXECUTE FUNCTION forbid_payload();`)
	require.NoError(t, e)
	m.Store.Now = func() time.Time { return first.Add(time.Hour) }
	refreshed, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	require.Equal(t, 1, refreshed.Refreshed)
	require.Zero(t, refreshed.RealUpdated)
	require.Equal(t, "job_refreshed", refreshed.Persisted[0].CatalogChange)
	require.Greater(t, refreshed.Persisted[0].CatalogRevision, old.CatalogRevision)
	var revision, indexed int64
	var last, expiry time.Time
	require.NoError(t, m.Store.DB.QueryRow(`SELECT revision,indexed_revision,last_seen_at,expires_at FROM job_catalog WHERE id=$1`, old.ID).Scan(&revision, &indexed, &last, &expiry))
	require.Less(t, indexed, revision)
	require.WithinDuration(t, m.Store.Now(), last, time.Microsecond)
	require.WithinDuration(t, m.Store.Now().Add(catalog.DefaultLifetime), expiry, time.Microsecond)
	// Stale acknowledgement cannot clear a newer durable refresh.
	require.NoError(t, m.Store.MarkIndexed(ctx, created.Persisted))
	require.NoError(t, m.Store.DB.QueryRow(`SELECT indexed_revision FROM job_catalog WHERE id=$1`, old.ID).Scan(&indexed))
	require.Less(t, indexed, revision)
	// Simulated crash: absent projection must rebuild via full fallback on reconcile.
	require.NoError(t, r.FlushDB(ctx).Err())
	report, e := m.Reconcile(ctx, true)
	require.NoError(t, e)
	require.Positive(t, report.Active)
	require.NoError(t, m.Store.DB.QueryRow(`SELECT indexed_revision FROM job_catalog WHERE id=$1`, old.ID).Scan(&indexed))
	require.Equal(t, revision, indexed)
	require.Positive(t, r.TTL(ctx, jobindex.Prefix(r.Get(ctx, jobindex.ActiveKey).Val())+"job:"+old.ID).Val())
	_, e = m.Store.DB.Exec(`DROP TRIGGER forbid_payload ON job_catalog`)
	require.NoError(t, e)
	// Each relevant effective field change advances revision and requests full apply.
	updates := []func(*domain.Job){func(j *domain.Job) { j.Description = "changed" }, func(j *domain.Job) { j.Location = "SAO PAULO" }, func(j *domain.Job) { j.Classification = &domain.Classification{PrimaryFamily: "data", InScope: true} }, func(j *domain.Job) { j.Salary = "100" }, func(j *domain.Job) { j.URL = "https://example.test/changed" }}
	for _, mutate := range updates {
		mutate(&j)
		result, e := m.Store.SaveBatch(ctx, []domain.Job{j})
		require.NoError(t, e)
		require.Equal(t, 1, result.RealUpdated)
		require.Equal(t, old.ID, result.Persisted[0].ID)
		require.Greater(t, result.Persisted[0].CatalogRevision, revision)
		revision = result.Persisted[0].CatalogRevision
	}
	// Current merge intentionally retains stored Title/Company for the same identity.
	j.Title = strings.ToUpper(j.Title)
	result, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	require.Equal(t, 1, result.Refreshed)
	// A normalized title change changes stable identity and is a CREATE, not UPDATE.
	newIdentity := j
	newIdentity.Title = "Different job"
	result, e = m.Store.SaveBatch(ctx, []domain.Job{newIdentity})
	require.NoError(t, e)
	require.Equal(t, 1, result.Inserted)
	_, e = m.Store.Deactivate(ctx, []string{old.ID})
	require.NoError(t, e)
	result, e = m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	require.Equal(t, 1, result.Reactivated)
	require.Zero(t, result.Refreshed)
	require.Equal(t, "job_reactivated", result.Persisted[0].CatalogChange)
	// Unknown JSON fields are conservatively rewritten, never classified as refresh.
	_, e = m.Store.DB.Exec(`UPDATE job_catalog SET payload=payload || '{"unknownFutureField":true}'::jsonb WHERE id=$1`, old.ID)
	require.NoError(t, e)
	result, e = m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	require.Equal(t, 1, result.RealUpdated)
}

func TestCatalogConcurrentRefreshAndUpdate(t *testing.T) {
	m, _ := integration(t)
	ctx := context.Background()
	j := sample("concurrent", "backend")
	j.Sources = []string{"test"}
	j.Keywords = []string{"sql"}
	j.Company = "company"
	j.Description = "initial"
	initial, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	run := func(inputs []domain.Job) []jobstore.SaveResult {
		results := make([]jobstore.SaveResult, len(inputs))
		errors := make([]error, len(inputs))
		var wg sync.WaitGroup
		start := make(chan struct{})
		for i := range inputs {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				results[i], errors[i] = m.Store.SaveBatch(ctx, []domain.Job{inputs[i]})
			}(i)
		}
		close(start)
		wg.Wait()
		for _, e := range errors {
			require.NoError(t, e)
		}
		return results
	}
	results := run([]domain.Job{j, j})
	require.Equal(t, 2, results[0].Refreshed+results[1].Refreshed)
	require.NotEqual(t, results[0].Persisted[0].CatalogRevision, results[1].Persisted[0].CatalogRevision)
	update := j
	update.Description = "changed"
	// A sparse refresh does not overwrite concurrent nonempty update content.
	refresh := j
	refresh.Description = ""
	results = run([]domain.Job{refresh, update})
	require.Equal(t, 1, results[0].Refreshed+results[1].Refreshed)
	require.Equal(t, 1, results[0].RealUpdated+results[1].RealUpdated)
	stored, e := m.Store.GetByIDs(ctx, []string{initial.Persisted[0].ID})
	require.NoError(t, e)
	require.Equal(t, "changed", stored[0].Description)
}

func TestCatalogRefreshCommitFailureDoesNotPublish(t *testing.T) {
	m, _ := integration(t)
	ctx := context.Background()
	j := sample("refresh-commit", "backend")
	j.Sources = []string{"test"}
	j.Keywords = []string{"sql"}
	initial, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	_, e = m.Store.DB.Exec(`CREATE FUNCTION fail_refresh_commit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced refresh commit failure'; END; $$ LANGUAGE plpgsql; CREATE CONSTRAINT TRIGGER fail_refresh_commit AFTER UPDATE ON job_catalog DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_refresh_commit();`)
	require.NoError(t, e)
	result, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.ErrorContains(t, e, "catalog commit")
	require.Empty(t, result.Persisted)
	require.Zero(t, result.Refreshed)
	var revision int64
	require.NoError(t, m.Store.DB.QueryRow(`SELECT revision FROM job_catalog WHERE id=$1`, initial.Persisted[0].ID).Scan(&revision))
	require.Equal(t, initial.Persisted[0].CatalogRevision, revision)
}

func TestCatalogOrderedMergeAndMixedBatchRollback(t *testing.T) {
	m, _ := integration(t)
	ctx := context.Background()
	j := sample("ordered", "backend")
	j.Sources = []string{"a", "b"}
	j.Source = "a, b"
	j.Keywords = []string{"first", "second"}
	j.Keyword = "first"
	initial, e := m.Store.SaveBatch(ctx, []domain.Job{j})
	require.NoError(t, e)
	incoming := j
	incoming.Sources = []string{"b", "a"}
	incoming.Keywords = []string{"second", "first"}
	result, e := m.Store.SaveBatch(ctx, []domain.Job{incoming})
	require.NoError(t, e)
	require.Equal(t, 1, result.Refreshed)
	require.Equal(t, j.Sources, result.Persisted[0].Sources)
	require.Equal(t, j.Keywords, result.Persisted[0].Keywords)
	require.Equal(t, "first", result.Persisted[0].Keyword)
	incoming.Sources = []string{"c"}
	incoming.Keywords = []string{"third"}
	result, e = m.Store.SaveBatch(ctx, []domain.Job{incoming})
	require.NoError(t, e)
	require.Equal(t, 1, result.RealUpdated)
	require.Equal(t, []string{"a", "b", "c"}, result.Persisted[0].Sources)
	require.Equal(t, "a, b, c", result.Persisted[0].Source)
	require.Equal(t, "first", result.Persisted[0].Keyword)
	lastRevision := result.Persisted[0].CatalogRevision
	_, e = m.Store.DB.Exec(`ALTER TABLE job_catalog ADD CONSTRAINT reject_batch CHECK (payload->>'title' <> 'fail')`)
	require.NoError(t, e)
	bad := sample("bad-mixed", "backend")
	bad.Title = "fail"
	result, e = m.Store.SaveBatch(ctx, []domain.Job{incoming, bad})
	require.Error(t, e)
	require.Empty(t, result.Persisted)
	require.Zero(t, result.Refreshed)
	var revision int64
	require.NoError(t, m.Store.DB.QueryRow(`SELECT revision FROM job_catalog WHERE id=$1`, initial.Persisted[0].ID).Scan(&revision))
	require.Equal(t, lastRevision, revision)
	// Expiration itself, without explicit deactivation, also requires reactivation.
	m.Store.Now = func() time.Time { return time.Now().Add(2 * catalog.DefaultLifetime) }
	result, e = m.Store.SaveBatch(ctx, []domain.Job{incoming})
	require.NoError(t, e)
	require.Equal(t, 1, result.Reactivated)
}

func BenchmarkCatalogSaveBatch(b *testing.B) {
	for _, size := range []int{4096, 16384} {
		for _, scenario := range []string{"unchanged", "mixed", "updates", "creates"} {
			b.Run(fmt.Sprintf("%s/%dB", scenario, size), func(b *testing.B) {
				m, _ := integration(b)
				ctx := context.Background()
				base := make([]domain.Job, 100)
				for i := range base {
					base[i] = sample(fmt.Sprint(i), "backend")
					base[i].Company = "benchmark"
					base[i].Description = strings.Repeat("Backend SQL Go product requirements. ", size/36+1)[:size]
					base[i].Sources = []string{"test"}
					base[i].Keywords = []string{"sql"}
				}
				_, e := m.Store.SaveBatch(ctx, base)
				require.NoError(b, e)
				b.ReportAllocs()
				b.ResetTimer()
				for n := 0; n < b.N; n++ {
					jobs := append([]domain.Job(nil), base...)
					for i := range jobs {
						switch scenario {
						case "mixed":
							if i < 10 {
								jobs[i].Description += fmt.Sprint(n)
							}
						case "updates":
							jobs[i].Description += fmt.Sprint(n)
						case "creates":
							jobs[i].Company = fmt.Sprintf("new-%d", n)
						}
					}
					result, e := m.Store.SaveBatch(ctx, jobs)
					if e != nil {
						b.Fatal(e)
					}
					if len(result.Persisted) != 100 {
						b.Fatal("incomplete batch")
					}
				}
				b.StopTimer()
				b.ReportMetric(100, "jobs/batch")
			})
		}
	}
}
