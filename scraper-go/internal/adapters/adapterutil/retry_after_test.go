package adapterutil

import (
	"github.com/stretchr/testify/require"
	"net/http"
	"testing"
	"time"
)

func TestRetryAfterDeltaAndHTTPDate(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	for value, want := range map[string]time.Time{"120": now.Add(2 * time.Minute), "0": now, now.Add(time.Hour).Format(http.TimeFormat): now.Add(time.Hour), now.Add(-time.Hour).Format(http.TimeFormat): now} {
		at, ok := ParseRetryAfter(value, now)
		require.True(t, ok)
		require.Equal(t, want, at)
	}
	for _, value := range []string{"", "-1", "invalid", "999999999999999999999"} {
		_, ok := ParseRetryAfter(value, now)
		require.False(t, ok)
	}
}
