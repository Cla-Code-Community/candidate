package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/stretchr/testify/require"
	"net/http/httptest"
	"testing"
)

type streamedCatalog struct{ jobstore.Catalog }

func (streamedCatalog) StreamActive(ctx context.Context, limit int, begin func(int64) error, emit func(domain.Job) error) error {
	if err := begin(1005); err != nil {
		return err
	}
	n := 1005
	if limit > 0 && limit < n {
		n = limit
	}
	for i := 0; i < n; i++ {
		if err := emit(domain.Job{ID: fmt.Sprint(i), Title: "Backend"}); err != nil {
			return err
		}
	}
	return nil
}
func TestAdministrativeCatalogPreservesFullAndLimitedListing(t *testing.T) {
	for _, tc := range []struct {
		query string
		count int
	}{{"", 1005}, {"?limit=2", 2}} {
		t.Run(tc.query, func(t *testing.T) {
			w := httptest.NewRecorder()
			r := httptest.NewRequest("GET", "/admin/jobs"+tc.query, nil)
			handleGetJobs(jobstore.NewDurable(nil, streamedCatalog{}))(w, r)
			require.Equal(t, 200, w.Code)
			var result struct {
				Total int
				Jobs  []domain.Job
			}
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &result))
			require.Equal(t, 1005, result.Total)
			require.Len(t, result.Jobs, tc.count)
		})
	}
}
