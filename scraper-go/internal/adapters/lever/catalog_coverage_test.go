package lever

import (
	"context"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestPAV178LeverQueries44CompaniesInBothWindows(t *testing.T) {
	t.Setenv("LEVER_COMPANIES_FILE", "../../interfaces/leverCompanies.json")
	sources, err := BuildLeverAdapters(context.Background())
	require.NoError(t, err)
	require.Len(t, sources, 44)
	calls := 0
	for _, source := range sources {
		source.(*LeverAdapter).client = testHTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testResponse(`[]`), nil })
	}
	for _, runID := range []string{"lever-1", "lever-2"} {
		for _, source := range sources {
			_, err := source.(*LeverAdapter).SearchCatalog(context.Background(), []string{"go"}, domain.ScrapeRequest{RunID: runID})
			require.NoError(t, err)
		}
	}
	require.Equal(t, 88, calls)
}
