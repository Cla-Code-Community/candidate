package config

import (
	"testing"

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
}

func TestLoadRuntimeConfigUsesEnvValue(t *testing.T) {
	cfg, err := LoadRuntimeConfigFromLookup(func(string) (string, bool) {
		return "8", true
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
