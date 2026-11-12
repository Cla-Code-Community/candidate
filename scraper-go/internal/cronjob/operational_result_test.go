package cronjob

import (
	"context"
	"errors"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestOperationalCycleFixtures(t *testing.T) {
	for _, success := range []int{5, 3, 2} {
		t.Run(fmt.Sprint(success), func(t *testing.T) {
			s, _, client := newConcurrentTestScheduler(t)
			s.adapterList = nil
			for i := 0; i < 5; i++ {
				n := i
				s.adapterList = append(s.adapterList, fixedGroupTestSource{id: fmt.Sprint(i), search: func(context.Context, string) ([]domain.Job, error) {
					if n >= success {
						return nil, errors.New("fixture HTTP status 503")
					}
					j := schedulerTestJob()
					j.URL = fmt.Sprintf("https://fixture.local/job/%d", n)
					return []domain.Job{j}, nil
				}})
			}
			lease, err := s.acquire(context.Background(), "cron")
			require.NoError(t, err)
			err = s.runSelectedWithLease(lease, []string{string(ports.ProviderGreenhouse)}, s.cfg.ScrapeTimeout)
			s.active.Done()
			want := "success"
			if success == 3 {
				want = "partial_success"
			}
			if success == 2 {
				want = "failed"
			}
			require.Equal(t, want, s.LastRun().Status)
			require.Equal(t, success == 2, err != nil)
			require.Positive(t, s.LastRun().JobsSaved)
			require.Positive(t, s.LastRun().JobsIndexed)
			require.Zero(t, client.Exists(context.Background(), runlock.LockKey).Val())
		})
	}
}
