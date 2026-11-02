package themuse

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestPAV178TheMuseDefaultStopsAt50ListingPages(t *testing.T) {
	a := NewTheMuse()
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) {
		calls++
		require.LessOrEqual(t, calls, 50)
		return testutil.Response(fmt.Sprintf(`{"results":[{"name":"Go Developer %d","company":{"name":"Acme"},"refs":{"landing_page":"https://example.test/job/%d"}}]}`, calls, calls)), nil
	})
	jobs, err := a.SearchCatalog(context.Background(), []string{"go"}, domain.ScrapeRequest{WaitBetweenSearchesMs: 1})
	require.NoError(t, err)
	require.Len(t, jobs, 50)
	require.Equal(t, 50, calls)
}
