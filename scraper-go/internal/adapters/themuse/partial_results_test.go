package themuse

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/require"
)

func TestTheMuseReturnsFirstPageWhenLaterPageFailsOrCancels(t *testing.T) {
	for _, cancelled := range []bool{false, true} {
		t.Run(fmt.Sprint(cancelled), func(t *testing.T) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			a := NewTheMuse()
			calls := 0
			a.client = testutil.HTTPClient(func(r *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					return testutil.Response(`{"results":[{"name":"Go Developer","company":{"name":"Acme"},"refs":{"landing_page":"https://example.com/job"},"contents":"Build Go APIs"}]}`), nil
				}
				if cancelled {
					cancel()
					return nil, ctx.Err()
				}
				return nil, errors.New("page unavailable")
			})
			jobs, err := a.SearchCatalog(ctx, []string{"go"}, domain.ScrapeRequest{WaitBetweenSearchesMs: 1})
			require.Error(t, err)
			require.Len(t, jobs, 1)
			require.Equal(t, 2, calls)
			if cancelled {
				require.ErrorIs(t, err, context.Canceled)
			}
		})
	}
}
