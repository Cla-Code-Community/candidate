package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestScrapeTimeoutDefaultAndOverride(t *testing.T) {
	cfg, err := LoadRuntimeConfigFromLookup(func(string) (string, bool) { return "", false })
	require.NoError(t, err)
	require.Equal(t, 50*time.Minute, cfg.ScrapeTimeout)
	for value, want := range map[string]time.Duration{"300s": 5 * time.Minute, " 2m ": 2 * time.Minute} {
		cfg, err = LoadRuntimeConfigFromLookup(func(key string) (string, bool) { return value, key == ScraperScrapeTimeoutEnv })
		require.NoError(t, err)
		require.Equal(t, want, cfg.ScrapeTimeout)
	}
	for _, value := range []string{"", " ", "0s", "-1m", "300", "invalid", "999999999999999h"} {
		_, err = LoadRuntimeConfigFromLookup(func(key string) (string, bool) { return value, key == ScraperScrapeTimeoutEnv })
		require.Error(t, err, value)
	}
}
