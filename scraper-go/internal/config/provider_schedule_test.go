package config

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestProviderWindowsRejectOverlapAndInvalidConfiguration(t *testing.T) {
	for _, value := range []string{"gupy", "unknown=01:00-02:00", "gupy=bad-02:00", "gupy=02:00-01:00", "gupy=01:00-01:00", "gupy=24:00-24:00", "gupy=00:00-25:00", "gupy=01:00-03:00,linkedin=02:00-04:00", "gupy=00:00-01:00,"} {
		_, err := ParseProviderWindows(value)
		require.Error(t, err, value)
	}
	windows, err := ParseProviderWindows("greenhouse=23:00-24:00, LinkedIn=01:00-02:00,gupy=02:00-03:00")
	require.NoError(t, err)
	require.Len(t, windows, 3)
	require.EqualValues(t, "linkedin", windows[0].Provider)
	require.Equal(t, 1440, windows[2].End)
	empty, err := ParseProviderWindows("")
	require.NoError(t, err)
	require.Empty(t, empty)
}

func TestProviderWindowEnvironmentAndBatchLimits(t *testing.T) {
	values := map[string]string{ProviderWindowsEnv: "greenhouse=01:00-02:00", "SCRAPER_GREENHOUSE_BATCH_SIZE": "20"}
	cfg, err := LoadRuntimeConfigFromLookup(func(k string) (string, bool) { v, ok := values[k]; return v, ok })
	require.NoError(t, err)
	require.Len(t, cfg.ProviderWindows, 1)
	require.Equal(t, 20, cfg.GreenhouseBatchSize)
	for _, value := range []string{"0", "1001", "bad"} {
		values["SCRAPER_GREENHOUSE_BATCH_SIZE"] = value
		_, err = LoadRuntimeConfigFromLookup(func(k string) (string, bool) { v, ok := values[k]; return v, ok })
		require.Error(t, err)
	}
}
