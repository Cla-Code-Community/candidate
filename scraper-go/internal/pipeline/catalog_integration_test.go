package pipeline

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalog"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func TestDurablePipelineOnlyIndexesAfterConfirmedCommit(t *testing.T) {
	dsn := os.Getenv("PAV125_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated PostgreSQL required")
	}
	ctx := context.Background()
	root, e := sql.Open("postgres", dsn)
	require.NoError(t, e)
	schema := fmt.Sprintf("pav125_pipeline_%d", time.Now().UnixNano())
	_, e = root.Exec("CREATE SCHEMA " + schema)
	require.NoError(t, e)
	db, e := sql.Open("postgres", dsn+"&search_path="+schema)
	require.NoError(t, e)
	t.Cleanup(func() { db.Close(); root.Exec("DROP SCHEMA " + schema + " CASCADE"); root.Close() })
	raw, e := os.ReadFile("../../../backend/drizzle/0015_job_catalog.sql")
	require.NoError(t, e)
	_, e = db.Exec(string(raw))
	require.NoError(t, e)
	_, e = db.Exec(`CREATE FUNCTION fail_commit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced deferred failure'; END; $$ LANGUAGE plpgsql; CREATE CONSTRAINT TRIGGER fail_commit AFTER INSERT ON job_catalog DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_commit();`)
	require.NoError(t, e)
	mr := miniredis.RunT(t)
	r := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer r.Close()
	source := catalog.New(db, catalog.DefaultLifetime)
	cfg := processConfig{Store: jobstore.NewDurable(r, source), RDB: r, ClassificationBatchSize: 2, PersistBatchSize: 2, IndexBatchSize: 2}
	_, stats, e := processIncomingJobs(ctx, feedJobs(inScopeJob(1), inScopeJob(2)), cfg)
	require.Error(t, e)
	require.Zero(t, stats.Indexed)
	require.Equal(t, int64(0), r.Exists(ctx, jobindex.GenerationKey, jobindex.ActiveKey, "scraper:jobs:index").Val())
	n, e := source.Count(ctx)
	require.NoError(t, e)
	require.Zero(t, n)
	_, e = db.Exec("DROP TRIGGER fail_commit ON job_catalog")
	require.NoError(t, e)
	jobs, stats, e := processIncomingJobs(ctx, feedJobs(inScopeJob(1), inScopeJob(2)), cfg)
	require.NoError(t, e)
	require.Len(t, jobs, 2)
	require.Equal(t, 2, stats.Indexed)
	require.Equal(t, 2, stats.Saved())
	for _, j := range jobs {
		var revision, indexed int64
		require.NoError(t, db.QueryRow("SELECT revision,indexed_revision FROM job_catalog WHERE id=$1", j.ID).Scan(&revision, &indexed))
		require.Equal(t, revision, indexed)
		require.True(t, r.SIsMember(ctx, "scraper:jobs:family:primary:backend", j.ID).Val())
	}
}
