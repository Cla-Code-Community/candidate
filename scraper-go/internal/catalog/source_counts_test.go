package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
	"time"
)

func TestSourceCountsFullActiveCatalog(t *testing.T) {
	dsn := os.Getenv("PAV125_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated PostgreSQL required")
	}
	root, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	schema := fmt.Sprintf("pav126_sources_%d", time.Now().UnixNano())
	_, err = root.Exec("CREATE SCHEMA " + schema)
	require.NoError(t, err)
	db, err := sql.Open("postgres", dsn+"&search_path="+schema)
	require.NoError(t, err)
	t.Cleanup(func() { db.Close(); root.Exec("DROP SCHEMA " + schema + " CASCADE"); root.Close() })
	_, err = db.Exec(`CREATE TABLE job_catalog(id text,payload jsonb,expires_at timestamptz,revision bigint)`)
	require.NoError(t, err)
	for i := 0; i < 205; i++ {
		source := any("Green House")
		if i >= 200 {
			source = "LinkedIn"
		}
		if i == 204 {
			source = nil
		}
		raw, _ := json.Marshal(map[string]any{"source": source, "sources": []string{"Lever", "Gupy"}})
		_, err = db.Exec(`INSERT INTO job_catalog VALUES($1,$2,now()+interval '1 day',1)`, fmt.Sprint(i), string(raw))
		require.NoError(t, err)
	}
	_, err = db.Exec(`INSERT INTO job_catalog VALUES('expired','{"source":"Jooble"}',now()-interval '1 day',1)`)
	require.NoError(t, err)
	store := New(db, DefaultLifetime)
	counts, err := store.SourceCounts(context.Background())
	require.NoError(t, err)
	total := int64(0)
	bySource := map[string]int64{}
	for _, c := range counts {
		total += c.Total
		if c.Source == nil {
			bySource["missing"] = c.Total
		} else {
			bySource[*c.Source] = c.Total
		}
	}
	require.Equal(t, map[string]int64{"Green House": 200, "LinkedIn": 4, "missing": 1}, bySource)
	n, err := store.Count(context.Background())
	require.NoError(t, err)
	require.Equal(t, n, total)
	sample, err := store.Sample(context.Background(), 2)
	require.NoError(t, err)
	require.Len(t, sample, 2)
	require.Equal(t, int64(205), total)
	_, err = db.Exec(`DELETE FROM job_catalog`)
	require.NoError(t, err)
	counts, err = store.SourceCounts(context.Background())
	require.NoError(t, err)
	require.Empty(t, counts)
	require.NotNil(t, counts)
}
