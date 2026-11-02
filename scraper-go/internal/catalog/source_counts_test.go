package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
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

func TestContentEqualityPreservesPersistedSemantics(t *testing.T) {
	base := domain.Job{ID: "id", Title: "title", Company: "company", Location: "location", URL: "url", Sources: []string{"a", "b"}, Keywords: []string{"first", "second"}, Classification: &domain.Classification{PrimaryFamily: "backend", RelatedFamilies: []string{"platform", "data"}, Technologies: []string{"go", "sql"}, Reasons: []string{"one", "two"}, InScope: true, Confidence: .8}}
	other := base
	other.CatalogRevision = 100
	other.CatalogChange = "job_refreshed"
	other.CatalogExpiresAt = time.Now()
	require.True(t, sameContent(base, other))
	changes := map[string]func(*domain.Job){
		"title": func(j *domain.Job) { j.Title = "other" }, "company": func(j *domain.Job) { j.Company = "other" },
		"description": func(j *domain.Job) { j.Description = "other" }, "location": func(j *domain.Job) { j.Location = "other" },
		"url": func(j *domain.Job) { j.URL = "other" }, "salary": func(j *domain.Job) { j.Salary = "other" },
		"modality": func(j *domain.Job) { j.Modality = "remote" }, "posted": func(j *domain.Job) { j.PostedAt = "date" },
		"source": func(j *domain.Job) { j.Source = "other" }, "keyword": func(j *domain.Job) { j.Keyword = "second" },
		"sources_order": func(j *domain.Job) { j.Sources = []string{"b", "a"} }, "keywords_order": func(j *domain.Job) { j.Keywords = []string{"second", "first"} },
		"family":             func(j *domain.Job) { j.Classification.PrimaryFamily = "data" },
		"related_order":      func(j *domain.Job) { j.Classification.RelatedFamilies = []string{"data", "platform"} },
		"technologies_order": func(j *domain.Job) { j.Classification.Technologies = []string{"sql", "go"} },
		"reasons_order":      func(j *domain.Job) { j.Classification.Reasons = []string{"two", "one"} },
		"seniority":          func(j *domain.Job) { j.Classification.Seniority = "senior" },
		"scope":              func(j *domain.Job) { j.Classification.InScope = false }, "confidence": func(j *domain.Job) { j.Classification.Confidence = .9 },
	}
	for name, mutate := range changes {
		t.Run(name, func(t *testing.T) {
			changed := base
			c := *base.Classification
			changed.Classification = &c
			mutate(&changed)
			require.False(t, sameContent(base, changed))
		})
	}
	a := domain.Job{Classification: &domain.Classification{}}
	b := domain.Job{Classification: &domain.Classification{Reasons: []string{}, Technologies: []string{}, RelatedFamilies: []string{}}}
	require.True(t, sameContent(a, b))
	b.Sources = []string{}
	require.False(t, sameContent(a, b))
}
