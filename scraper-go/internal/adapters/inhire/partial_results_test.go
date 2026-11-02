package inhire

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestInHireReturnsCollectedTenantWhenAnotherFailsOrCancels(t *testing.T) {
	for _, cancelled := range []bool{false, true} {
		t.Run(fmt.Sprint(cancelled), func(t *testing.T) {
			file := writeInHireTenantsFile(t, `[{"slug":"a","tenantName":"Acme"},{"slug":"b","tenantName":"Other"}]`)
			t.Setenv("INHIRE_TENANTS_FILE", file)
			t.Setenv("INHIRE_ENRICH_DETAILS", "false")
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			a := NewInHire()
			a.client = testHTTPClient(func(r *http.Request) (*http.Response, error) {
				if r.Header.Get("X-Tenant") == "a" {
					return testResponse(`{"jobsPage":[{"displayName":"Desenvolvedor Go","jobId":"one","status":"published","workplaceType":"Remote","location":"Brasil"}]}`), nil
				}
				if cancelled {
					cancel()
					return nil, ctx.Err()
				}
				return nil, errors.New("tenant unavailable")
			})
			jobs, err := a.SearchCatalog(ctx, []string{"go"}, domain.ScrapeRequest{})
			require.Error(t, err)
			require.Len(t, jobs, 1)
			require.NotEmpty(t, jobs[0].URL)
			if cancelled {
				require.ErrorIs(t, err, context.Canceled)
			}
		})
	}
}
