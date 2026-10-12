package main

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"net/http/httptest"
	"testing"
)

type countedCatalog struct {
	jobstore.Catalog
	fail bool
}

func (c countedCatalog) Count(context.Context) (int64, error) { return 9, nil }
func (c countedCatalog) SourceCounts(context.Context) ([]jobstore.SourceCount, error) {
	if c.fail {
		return nil, errors.New("unavailable")
	}
	return []jobstore.SourceCount{{Source: strPtr("Green House"), Total: 6}, {Source: strPtr("LinkedIn"), Total: 2}, {Source: nil, Total: 1}}, nil
}
func strPtr(s string) *string { return &s }

type configuredAdapter string

func (a configuredAdapter) SourceName() string { return string(a) }
func (a configuredAdapter) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	return nil, nil
}
func TestCatalogCountsAndConfiguredInventory(t *testing.T) {
	for _, partial := range []bool{false, true} {
		w := httptest.NewRecorder()
		handleJobsCount(jobstore.NewDurable(nil, countedCatalog{fail: partial}), []ports.JobSource{configuredAdapter("Green House:company"), configuredAdapter("The Muse"), configuredAdapter("Green House:other")})(w, httptest.NewRequest("GET", "/admin/jobs/count", nil))
		require.Equal(t, 200, w.Code)
		var body struct {
			Total   int
			Sources []struct {
				Source   *string
				Provider string
				Total    int
			}
			ConfiguredProviders []string
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
		require.Equal(t, 9, body.Total)
		require.Equal(t, []string{"greenhouse", "themuse"}, body.ConfiguredProviders)
		if partial {
			require.Nil(t, body.Sources)
		} else {
			require.Len(t, body.Sources, 3)
			sum := 0
			for _, s := range body.Sources {
				sum += s.Total
			}
			require.Equal(t, body.Total, sum)
			require.Equal(t, "greenhouse", body.Sources[0].Provider)
			require.Nil(t, body.Sources[2].Source)
		}
	}
}
