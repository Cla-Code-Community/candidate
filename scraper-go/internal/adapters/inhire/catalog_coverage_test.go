package inhire

import (
	"context"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestPAV178InHireSelectsAll496ConfiguredTenants(t *testing.T) {
	t.Setenv("INHIRE_TENANTS_FILE", "../../interfaces/inhireTenants.json")
	t.Setenv("INHIRE_ENRICH_DETAILS", "false")
	a := NewInHire()
	seen := map[string]bool{}
	a.client = testHTTPClient(func(r *http.Request) (*http.Response, error) {
		slug := r.Header.Get("X-Tenant")
		require.False(t, seen[slug])
		seen[slug] = true
		return testResponse(`{"jobsPage":[]}`), nil
	})
	_, err := a.SearchCatalog(context.Background(), []string{"go"}, domain.ScrapeRequest{})
	require.NoError(t, err)
	require.Len(t, seen, 496)
}
