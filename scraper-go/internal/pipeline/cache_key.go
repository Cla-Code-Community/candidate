package pipeline

import (
	"sort"
	"strconv"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
)

func BuildCacheKey(config SearchConfig) string {
	normalizedKeywords := keywords.NormalizeKeywords(config.Keywords)
	sort.Strings(normalizedKeywords)

	sources := normalizeCacheValues(config.Sources)

	return strings.Join([]string{
		"jobs",
		strings.Join(normalizedKeywords, ","),
		normalizeCacheValue(config.SearchLocation),
		normalizeCacheValue(config.SearchGeoID),
		normalizeCacheValue(config.SearchLanguage),
		normalizeCacheValue(config.JobTypes),
		normalizeCacheValue(config.TimeFilter),
		strconv.FormatBool(config.RemoteOnly),
		strings.Join(sources, ","),
		strconv.Itoa(config.ResultsPerPage),
		strconv.Itoa(config.MaxPagesPerKeyword),
		strconv.Itoa(config.WaitBetweenSearchesMs),
		strconv.Itoa(config.PageTimeoutMs),
		strconv.Itoa(config.MaxConcurrency),
	}, ":")
}

func normalizeCacheValue(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeCacheValues(values []string) []string {
	unique := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))

	for _, value := range values {
		value = normalizeCacheValue(value)
		if value == "" {
			continue
		}
		if _, exists := unique[value]; exists {
			continue
		}
		unique[value] = struct{}{}
		normalized = append(normalized, value)
	}

	sort.Strings(normalized)

	return normalized
}
