package jooble

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newQuotaTestAdapter(t *testing.T) *JoobleAdapter {
	t.Helper()
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() { _ = client.Close() })
	return NewJooble("test-key", client)
}
func TestJoobleAtomicQuotaAllowsExactly150Reservations(t *testing.T) {
	t.Setenv("JOOBLE_DAILY_HTTP_LIMIT", "150")
	a := newQuotaTestAdapter(t)
	var allowed atomic.Int32
	var wg sync.WaitGroup
	for range 200 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if a.reserveQuota(context.Background()) == nil {
				allowed.Add(1)
			}
		}()
	}
	wg.Wait()
	require.EqualValues(t, 150, allowed.Load())
	require.Equal(t, "150", a.rdb.Get(context.Background(), joobleQuotaKey).Val())
}
func TestJoobleCountsFailuresAndCannotSendPastConfiguredLimit(t *testing.T) {
	t.Setenv("JOOBLE_DAILY_HTTP_LIMIT", "2")
	a := newQuotaTestAdapter(t)
	calls := 0
	a.client = testutil.HTTPClient(func(*http.Request) (*http.Response, error) { calls++; return nil, errors.New("transport failed") })
	for range 4 {
		_, _, err := a.fetchPage(context.Background(), "go", domain.ScrapeRequest{}, 1, 20)
		require.Error(t, err)
	}
	require.Equal(t, 2, calls)
	require.Equal(t, "2", a.rdb.Get(context.Background(), joobleQuotaKey).Val())
}
func TestJoobleQuotaFailsClosedWithoutStore(t *testing.T) {
	a := NewJooble("test-key", nil)
	require.Error(t, a.reserveQuota(context.Background()))
}

func TestJooble150AttemptsAreSharedAcrossAdapterInstances(t *testing.T) {
	t.Setenv("JOOBLE_DAILY_HTTP_LIMIT", "150")
	a := newQuotaTestAdapter(t)
	b := NewJooble("test-key", a.rdb)
	calls := 0
	client := testutil.HTTPClient(func(*http.Request) (*http.Response, error) { calls++; return testutil.Response(`{"jobs":[]}`), nil })
	a.client = client
	b.client = client
	for _, adapter := range []*JoobleAdapter{a, b} {
		for range 100 {
			_, _, _ = adapter.fetchPage(context.Background(), "go", domain.ScrapeRequest{}, 2, 20)
		}
	}
	require.Equal(t, 150, calls)
	require.Equal(t, "150", a.rdb.Get(context.Background(), joobleQuotaKey).Val())
}

func TestJoobleQuotaRejectsInvalidConfiguration(t *testing.T) {
	for _, value := range []string{"0", "-1", "151", "bad"} {
		t.Setenv("JOOBLE_DAILY_HTTP_LIMIT", value)
		_, err := joobleDailyLimit()
		require.Error(t, err)
	}
}
