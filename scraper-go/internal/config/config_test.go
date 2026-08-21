package config

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadRuntimeConfigUsesDefaultWhenEnvMissing(t *testing.T) {
	cfg, err := LoadRuntimeConfigFromLookup(func(string) (string, bool) {
		return "", false
	})

	require.NoError(t, err)
	assert.Equal(t, 12, cfg.MaxConcurrency)
	assert.Equal(t, SourceInternalDefault, cfg.MaxConcurrencySource)
	assert.Equal(t, 120*time.Second, cfg.RunLockTTL)
	assert.Equal(t, 30*time.Second, cfg.RunLockRenewInterval)
}

func TestLoadRuntimeConfigUsesEnvValue(t *testing.T) {
	cfg, err := LoadRuntimeConfigFromLookup(func(key string) (string, bool) {
		if key == ScraperMaxConcurrencyEnv {
			return "8", true
		}
		return "", false
	})

	require.NoError(t, err)
	assert.Equal(t, 8, cfg.MaxConcurrency)
	assert.Equal(t, SourceEnvironment, cfg.MaxConcurrencySource)
}

func TestLoadRuntimeConfigRejectsInvalidEnvValues(t *testing.T) {
	cases := []struct {
		name  string
		value string
	}{
		{name: "empty", value: ""},
		{name: "blank", value: "   "},
		{name: "zero", value: "0"},
		{name: "negative", value: "-1"},
		{name: "not numeric", value: "abc"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := LoadRuntimeConfigFromLookup(func(string) (string, bool) {
				return tc.value, true
			})

			require.Error(t, err)
		})
	}
}

func TestResolveEffectiveConcurrency(t *testing.T) {
	assert.Equal(t, 12, ResolveEffectiveConcurrency(0, 12))
	assert.Equal(t, 12, ResolveEffectiveConcurrency(-1, 12))
	assert.Equal(t, 8, ResolveEffectiveConcurrency(8, 12))
	assert.Equal(t, 12, ResolveEffectiveConcurrency(40, 12))
}

func TestLoadRuntimeConfigUsesRunLockDurationsFromEnvironment(t *testing.T) {
	values := map[string]string{
		ScraperRunLockTTLEnv:           "3m",
		ScraperRunLockRenewIntervalEnv: "45s",
	}

	cfg, err := LoadRuntimeConfigFromLookup(func(key string) (string, bool) {
		value, ok := values[key]
		return value, ok
	})

	require.NoError(t, err)
	assert.Equal(t, 3*time.Minute, cfg.RunLockTTL)
	assert.Equal(t, 45*time.Second, cfg.RunLockRenewInterval)
}

func TestLoadRuntimeConfigRejectsInvalidRunLockDurations(t *testing.T) {
	cases := []struct {
		name   string
		values map[string]string
	}{
		{
			name:   "invalid ttl",
			values: map[string]string{ScraperRunLockTTLEnv: "invalid"},
		},
		{
			name:   "zero ttl",
			values: map[string]string{ScraperRunLockTTLEnv: "0s"},
		},
		{
			name:   "negative renewal interval",
			values: map[string]string{ScraperRunLockRenewIntervalEnv: "-1s"},
		},
		{
			name: "renewal equals ttl",
			values: map[string]string{
				ScraperRunLockTTLEnv:           "30s",
				ScraperRunLockRenewIntervalEnv: "30s",
			},
		},
		{
			name: "renewal exceeds ttl",
			values: map[string]string{
				ScraperRunLockTTLEnv:           "30s",
				ScraperRunLockRenewIntervalEnv: "31s",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := LoadRuntimeConfigFromLookup(func(key string) (string, bool) {
				value, ok := tc.values[key]
				return value, ok
			})

			require.Error(t, err)
		})
	}
}
