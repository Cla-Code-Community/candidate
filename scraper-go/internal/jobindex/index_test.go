package jobindex

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/alicebob/miniredis/v2"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func setup(t *testing.T) (*Manager, *redis.Client) {
	t.Helper()
	r := miniredis.RunT(t)
	c := redis.NewClient(&redis.Options{Addr: r.Addr()})
	t.Cleanup(func() { c.Close() })
	m := New(c)
	m.Now = func() time.Time { return time.Unix(2000000000, 0) }
	return m, c
}
func committed(id, family string, related []string, revision int64) domain.Job {
	return domain.Job{ID: id, Title: "A job", Sources: []string{}, Keywords: []string{}, CatalogRevision: revision, CatalogExpiresAt: time.Unix(2000003600, 0), Classification: &domain.Classification{PrimaryFamily: family, RelatedFamilies: related}}
}
func noKeys(domain.Job) []string { return nil }
func TestCanonicalPlans(t *testing.T) {
	for _, f := range taxonomy.Families() {
		t.Run(f.ID, func(t *testing.T) {
			p, e := Build(committed("id", f.ID, []string{f.ID, "platform", "platform"}, 1), nil)
			require.NoError(t, e)
			require.Contains(t, p.Keys, "family:"+f.ID)
			require.Contains(t, p.Keys, "family:primary:"+f.ID)
			require.NotContains(t, p.Keys, "family:related:"+f.ID)
			require.NotContains(t, p.Keys, "family:other")
		})
	}
	for _, f := range []string{"finance", "Backend", ""} {
		_, e := Build(committed("id", f, nil, 1), nil)
		require.Error(t, e)
	}
	p, e := Build(committed("id", "other", nil, 1), nil)
	require.NoError(t, e)
	require.Empty(t, p.Keys)
	_, e = Build(committed("id", "backend", []string{"finance"}, 1), nil)
	require.Error(t, e)
	_, e = Build(domain.Job{ID: "uncommitted"}, nil)
	require.Error(t, e)
}
func TestReclassificationAtomicIdempotent(t *testing.T) {
	m, c := setup(t)
	ctx := context.Background()
	j := committed("a", "leadership", []string{"backend"}, 1)
	other := committed("b", "leadership", nil, 2)
	n, e := m.Apply(ctx, []domain.Job{j, other}, noKeys)
	require.NoError(t, e)
	require.Equal(t, 2, n)
	j = committed("a", "backend", []string{"platform", "backend", "platform"}, 3)
	_, e = m.Apply(ctx, []domain.Job{j}, noKeys)
	require.NoError(t, e)
	p := Prefix(Bootstrap)
	require.False(t, c.SIsMember(ctx, p+"family:primary:leadership", "a").Val())
	require.True(t, c.SIsMember(ctx, p+"family:primary:leadership", "b").Val())
	require.False(t, c.SIsMember(ctx, p+"family:related:backend", "a").Val())
	require.True(t, c.SIsMember(ctx, p+"family:backend", "a").Val())
	require.True(t, c.SIsMember(ctx, p+"family:related:platform", "a").Val())
	var meta Plan
	require.NoError(t, json.Unmarshal([]byte(c.Get(ctx, p+"index-membership:a").Val()), &meta))
	require.Equal(t, []string{"platform"}, meta.Related)
	require.Equal(t, taxonomy.Version(), meta.Taxonomy)
	before := c.Get(ctx, GenerationKey).Val()
	n, e = m.Apply(ctx, []domain.Job{j}, noKeys)
	require.NoError(t, e)
	require.Zero(t, n)
	require.Equal(t, before, c.Get(ctx, GenerationKey).Val())
	_, e = m.Apply(ctx, []domain.Job{committed("a", "frontend", nil, 1)}, noKeys)
	require.NoError(t, e)
	require.True(t, c.SIsMember(ctx, p+"family:primary:backend", "a").Val())
	var doc domain.Job
	require.NoError(t, json.Unmarshal([]byte(c.Get(ctx, p+"job:a").Val()), &doc))
	require.Equal(t, j.ID, doc.ID)
}
func TestProductTransitionsAndIndependence(t *testing.T) {
	m, c := setup(t)
	ctx := context.Background()
	p := Prefix(Bootstrap)
	for i, f := range []string{"other", "product", "product_design"} {
		_, e := m.Apply(ctx, []domain.Job{committed("a", f, nil, int64(i+1))}, noKeys)
		require.NoError(t, e)
	}
	require.False(t, c.SIsMember(ctx, p+"family:product", "a").Val())
	require.True(t, c.SIsMember(ctx, p+"family:primary:product_design", "a").Val())
	require.Equal(t, int64(0), c.Exists(ctx, p+"family:other").Val())
	for i, f := range []string{"fullstack", "devops", "platform"} {
		_, e := m.Apply(ctx, []domain.Job{committed(f, f, nil, int64(i+10))}, noKeys)
		require.NoError(t, e)
	}
	require.False(t, c.SIsMember(ctx, p+"family:backend", "fullstack").Val())
	require.False(t, c.SIsMember(ctx, p+"family:frontend", "fullstack").Val())
	require.False(t, c.SIsMember(ctx, p+"family:devops", "platform").Val())
}
func TestPreflightFailureDoesNotPartiallyMutate(t *testing.T) {
	m, c := setup(t)
	ctx := context.Background()
	p := Prefix(Bootstrap)
	c.Set(ctx, p+"family:primary:product", "wrong type", 0)
	_, e := m.Apply(ctx, []domain.Job{committed("valid", "backend", nil, 1), committed("bad", "product", nil, 2)}, noKeys)
	require.Error(t, e)
	require.Equal(t, int64(0), c.Exists(ctx, p+"family:backend", GenerationKey).Val())
	_, e = m.Apply(ctx, []domain.Job{committed("valid", "backend", nil, 1), committed("bad", "finance", nil, 2)}, noKeys)
	require.Error(t, e)
	require.Equal(t, int64(0), c.Exists(ctx, p+"family:backend").Val())
	_, e = m.Apply(ctx, []domain.Job{committed("same", "backend", nil, 1), committed("same", "frontend", nil, 2)}, noKeys)
	require.Error(t, e)
	_, e = m.Apply(ctx, make([]domain.Job, 2501), noKeys)
	require.Error(t, e)
}
func TestExpirationAndDraftGeneration(t *testing.T) {
	m, c := setup(t)
	ctx := context.Background()
	j := committed("a", "backend", nil, 1)
	_, e := m.ApplyVersion(ctx, "v2-test", []domain.Job{j}, noKeys, true)
	require.NoError(t, e)
	require.Equal(t, int64(0), c.Exists(ctx, GenerationKey, "scraper:jobs:family:backend").Val())
	require.Positive(t, c.TTL(ctx, Prefix("v2-test")+"family:backend").Val())
	_, e = m.Apply(ctx, []domain.Job{j}, noKeys)
	require.NoError(t, e)
	m.Now = func() time.Time { return j.CatalogExpiresAt }
	_, e = m.Apply(ctx, []domain.Job{j}, noKeys)
	require.NoError(t, e)
	require.False(t, c.SIsMember(ctx, Prefix(Bootstrap)+"family:backend", "a").Val())
	require.False(t, c.SIsMember(ctx, "scraper:jobs:index", "a").Val())
	before := c.Get(ctx, GenerationKey).Val()
	n, e := m.Apply(ctx, []domain.Job{j}, noKeys)
	require.NoError(t, e)
	require.Zero(t, n)
	require.Equal(t, before, c.Get(ctx, GenerationKey).Val())
	ctx, cancel := context.WithCancel(ctx)
	cancel()
	_, e = m.Apply(ctx, []domain.Job{j}, noKeys)
	require.Error(t, e)
}

func TestMalformedMembershipAndGenerationCannotCausePartialWrites(t *testing.T) {
	for _, corruption := range []string{"membership", "generation"} {
		t.Run(corruption, func(t *testing.T) {
			m, c := setup(t)
			ctx := context.Background()
			if corruption == "membership" {
				c.Set(ctx, Prefix(Bootstrap)+"index-membership:bad", `{"revision":"invalid","keys":[]}`, 0)
			} else {
				c.Set(ctx, GenerationKey, "1.5", 0)
			}
			_, e := m.Apply(ctx, []domain.Job{committed("first", "backend", nil, 1), committed("bad", "product", nil, 2)}, noKeys)
			require.Error(t, e)
			require.Zero(t, c.Exists(ctx, Prefix(Bootstrap)+"family:backend").Val())
		})
	}
}

func TestRealValkeyProjection(t *testing.T) {
	url := os.Getenv("PAV125_TEST_VALKEY_URL")
	if url == "" {
		t.Skip("isolated real Valkey URL not set")
	}
	opts, e := redis.ParseURL(url)
	require.NoError(t, e)
	client := redis.NewClient(opts)
	defer client.Close()
	ctx := context.Background()
	m := New(client)
	version := fmt.Sprintf("v2-real-%d", time.Now().UnixNano())
	prefix := Prefix(version)
	defer func() {
		var cursor uint64
		for {
			names, next, err := client.Scan(ctx, cursor, prefix+"*", 100).Result()
			require.NoError(t, err)
			if len(names) > 0 {
				client.Del(ctx, names...)
			}
			cursor = next
			if cursor == 0 {
				break
			}
		}
	}()
	j := committed("a", "product", nil, 1)
	j.CatalogExpiresAt = time.Now().Add(time.Hour)
	j.Sources = []string{}
	j.Keywords = []string{}
	_, e = m.ApplyVersion(ctx, version, []domain.Job{j}, noKeys, true)
	require.NoError(t, e)
	var actual domain.Job
	require.NoError(t, json.Unmarshal([]byte(client.Get(ctx, prefix+"job:a").Val()), &actual))
	require.Equal(t, []string{}, actual.Sources)
	require.Equal(t, []string{}, actual.Keywords)
	j.CatalogRevision = 2
	j.Classification.PrimaryFamily = "product_design"
	_, e = m.ApplyVersion(ctx, version, []domain.Job{j}, noKeys, true)
	require.NoError(t, e)
	require.False(t, client.SIsMember(ctx, prefix+"family:product", "a").Val())
	require.True(t, client.SIsMember(ctx, prefix+"family:primary:product_design", "a").Val())
}

func TestInvalidTelemetryCannotBlockAtomicIndexPublication(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	ctx := context.Background()
	m := New(rdb)
	j := domain.Job{ID: "telemetry-job", Title: "Backend", CatalogRevision: 1, CatalogExpiresAt: time.Now().Add(time.Hour), Classification: &domain.Classification{PrimaryFamily: "backend", InScope: true}}
	require.NoError(t, rdb.Set(ctx, "scraper:observability:maintenance-metrics", "invalid-telemetry", 0).Err())
	_, err := m.Apply(ctx, []domain.Job{j}, func(domain.Job) []string { return nil })
	require.NoError(t, err)
	require.True(t, rdb.SIsMember(ctx, Prefix(Bootstrap)+"family:primary:backend", j.ID).Val())
	require.Equal(t, "1", rdb.Get(ctx, GenerationKey).Val())
}

func TestIndexTelemetryIncludesActiveNamespaceLookupFailure(t *testing.T) {
	m, client := setup(t)
	client.Close()
	before := testutil.ToFloat64(metrics.IndexBatches.WithLabelValues("failed"))
	_, err := m.Apply(context.Background(), []domain.Job{committed("unindexed", "backend", nil, 1)}, noKeys)
	require.Error(t, err)
	require.Equal(t, before+1, testutil.ToFloat64(metrics.IndexBatches.WithLabelValues("failed")))
}
