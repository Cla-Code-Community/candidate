package jobstore

import (
	"context"
	"fmt"
)

// SourceCount partitions active catalog rows by their primary source. Multi-source
// provenance is deliberately not expanded: each catalog identity counts once.
type SourceCount struct {
	Source *string
	Total  int64
}
type sourceCounter interface {
	SourceCounts(context.Context) ([]SourceCount, error)
}

func (s *Store) SourceCounts(ctx context.Context) ([]SourceCount, error) {
	if source, ok := s.catalog.(sourceCounter); ok {
		return source.SourceCounts(ctx)
	}
	return nil, fmt.Errorf("source aggregation unavailable for this catalog")
}
