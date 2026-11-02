package pipeline

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalog"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func TestPAV178PartialCollectionCommitsAndIndexesOnRealDisposableServices(t *testing.T) {
	dsn, endpoint := os.Getenv("PAV125_TEST_DATABASE_URL"), os.Getenv("PAV125_TEST_VALKEY_URL")
	if dsn == "" || endpoint == "" {
		t.Skip("isolated PostgreSQL and Valkey required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	root, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	defer root.Close()
	schema := fmt.Sprintf("pav178_%d", time.Now().UnixNano())
	_, err = root.ExecContext(ctx, "CREATE SCHEMA "+schema)
	require.NoError(t, err)
	defer root.Exec("DROP SCHEMA " + schema + " CASCADE")
	db, err := sql.Open("postgres", dsn+"&search_path="+schema)
	require.NoError(t, err)
	defer db.Close()
	migration, err := os.ReadFile("../../../backend/drizzle/0015_job_catalog.sql")
	require.NoError(t, err)
	_, err = db.ExecContext(ctx, string(migration))
	require.NoError(t, err)
	options, err := redis.ParseURL(endpoint)
	require.NoError(t, err)
	rdb := redis.NewClient(options)
	defer rdb.Close()
	catalogStore := catalog.New(db, catalog.DefaultLifetime)
	sources := []ports.JobSource{
		schedulerTestAdapter{provider: ports.ProviderGupy, search: func(context.Context, string) ([]domain.Job, error) { return []domain.Job{inScopeJob(701)}, nil }},
		schedulerTestAdapter{provider: ports.ProviderAdzuna, search: func(ctx context.Context, _ string) ([]domain.Job, error) {
			<-ctx.Done()
			return []domain.Job{inScopeJob(702)}, ctx.Err()
		}},
	}
	jobs, stats, err := ScrapeAllSources(ctx, SearchConfig{RunID: "pav178-real-partial", Keywords: []string{"go"}, CollectionTimeout: 150 * time.Millisecond, MaxConcurrency: 2, ProviderMaxConcurrency: 1, Store: jobstore.NewDurable(rdb, catalogStore), ClassificationBatchSize: 1, PersistBatchSize: 1, IndexBatchSize: 1}, sources, rdb)
	require.ErrorIs(t, err, context.DeadlineExceeded)
	require.Len(t, jobs, 2)
	require.Equal(t, 2, stats.Saved())
	require.Equal(t, 2, stats.Indexed)
	version, err := jobindex.New(rdb).Active(ctx)
	require.NoError(t, err)
	for _, job := range jobs {
		var revision, indexed int64
		require.NoError(t, db.QueryRowContext(ctx, "SELECT revision,indexed_revision FROM job_catalog WHERE id=$1", job.ID).Scan(&revision, &indexed))
		require.Equal(t, revision, indexed)
		raw, err := rdb.Get(ctx, jobindex.Prefix(version)+"job:"+job.ID).Bytes()
		require.NoError(t, err)
		var document domain.Job
		require.NoError(t, json.Unmarshal(raw, &document))
		require.Equal(t, job.ID, document.ID)
	}
}
