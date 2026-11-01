package adapters_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
)

func TestRegistryIncludesEveryConfiguredProviderWithoutScraping(t *testing.T) {
	for _, key := range []string{"GUPY_ENABLED", "INHIRE_ENABLED", "GREENHOUSE_ENABLED", "LEVER_ENABLED"} {
		t.Setenv(key, "true")
	}
	for _, key := range []string{"ADZUNA_APP_ID", "ADZUNA_APP_KEY", "JOOBLE_API_KEY"} {
		t.Setenv(key, "test-credential")
	}
	dir := t.TempDir()
	greenhouse := filepath.Join(dir, "greenhouse.json")
	lever := filepath.Join(dir, "lever.json")
	require.NoError(t, os.WriteFile(greenhouse, []byte(`["test-board"]`), 0600))
	require.NoError(t, os.WriteFile(lever, []byte(`[{"site":"test-board","companyName":"Test"}]`), 0600))
	t.Setenv("GREENHOUSE_COMPANIES_FILE", greenhouse)
	t.Setenv("LEVER_COMPANIES_FILE", lever)
	providers := map[ports.ProviderID]int{}
	for _, source := range adapters.GetAdapters(nil) {
		providers[ports.CapabilitiesOf(source).Provider]++
	}
	require.Len(t, providers, 8)
	for _, id := range []ports.ProviderID{ports.ProviderLinkedIn, ports.ProviderAdzuna, ports.ProviderGupy, ports.ProviderInHire, ports.ProviderGreenhouse, ports.ProviderLever, ports.ProviderJooble, ports.ProviderTheMuse} {
		require.Equal(t, 1, providers[id], id)
	}
}
