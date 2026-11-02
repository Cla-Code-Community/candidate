package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/stretchr/testify/require"
)

func TestScrapeRejectsInvalidProviderSelectionWithBadRequest(t *testing.T) {
	for _, provider := range []string{"invalid", "gupy"} {
		r := httptest.NewRequest(http.MethodPost, "/scrape", strings.NewReader(`{"keywords":["go"],"sources":["`+provider+`"]}`))
		w := httptest.NewRecorder()
		handleScrape(nil, nil, cache.NewMemoryCache(), nil, nil, config.RuntimeConfig{MaxConcurrency: 4}).ServeHTTP(w, r)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "INVALID_PROVIDER_SELECTION")
	}
}
