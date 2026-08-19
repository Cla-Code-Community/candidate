package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	DefaultMaxConcurrency = 12

	SourceEnvironment     = "environment"
	SourceInternalDefault = "internal_default"

	ScraperMaxConcurrencyEnv = "SCRAPER_MAX_CONCURRENCY"
)

type RuntimeConfig struct {
	MaxConcurrency       int
	MaxConcurrencySource string
}

func LoadRuntimeConfig() (RuntimeConfig, error) {
	return LoadRuntimeConfigFromLookup(os.LookupEnv)
}

func LoadRuntimeConfigFromLookup(lookup func(string) (string, bool)) (RuntimeConfig, error) {
	value, ok := lookup(ScraperMaxConcurrencyEnv)
	if !ok {
		return RuntimeConfig{
			MaxConcurrency:       DefaultMaxConcurrency,
			MaxConcurrencySource: SourceInternalDefault,
		}, nil
	}

	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return RuntimeConfig{}, fmt.Errorf("%s must be a positive integer", ScraperMaxConcurrencyEnv)
	}

	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return RuntimeConfig{}, fmt.Errorf("%s must be a positive integer: %w", ScraperMaxConcurrencyEnv, err)
	}
	if parsed <= 0 {
		return RuntimeConfig{}, fmt.Errorf("%s must be greater than zero", ScraperMaxConcurrencyEnv)
	}

	return RuntimeConfig{
		MaxConcurrency:       parsed,
		MaxConcurrencySource: SourceEnvironment,
	}, nil
}

func ResolveEffectiveConcurrency(requested, globalMax int) int {
	if requested <= 0 {
		return globalMax
	}
	if requested > globalMax {
		return globalMax
	}
	return requested
}
