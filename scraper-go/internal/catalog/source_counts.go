package catalog

import (
	"context"
	"database/sql"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
)

// A single statement sees one PostgreSQL snapshot and the same activity cutoff
// as Count. Returns groups only, without decoding/loading catalog documents.
func (s *Store) SourceCounts(ctx context.Context) ([]jobstore.SourceCount, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT NULLIF(btrim(payload->>'source'),'') AS source,count(*) FROM job_catalog WHERE expires_at>$1 GROUP BY 1 ORDER BY 1 NULLS LAST`, s.Now().UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	counts := make([]jobstore.SourceCount, 0)
	for rows.Next() {
		var source sql.NullString
		var c jobstore.SourceCount
		if err = rows.Scan(&source, &c.Total); err != nil {
			return nil, err
		}
		if source.Valid {
			v := source.String
			c.Source = &v
		}
		counts = append(counts, c)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return counts, nil
}
