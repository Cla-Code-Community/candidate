package pipeline

import (
	"errors"
	"fmt"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

// ErrInvalidProviderSelection includes unknown IDs and providers absent from the
// configured registry. An explicit selection must never fall back to all sources.
var ErrInvalidProviderSelection = errors.New("invalid provider selection")

// SelectProviders validates an explicit request against the startup registry.
// Callers use the same selection rules for scheduling and manual execution.
func SelectProviders(sources []ports.JobSource, requested []string) ([]ports.JobSource, error) {
	return selectProviders(sources, requested)
}

func selectProviders(sources []ports.JobSource, requested []string) ([]ports.JobSource, error) {
	if len(requested) == 0 {
		return sources, nil
	}
	selected := make(map[ports.ProviderID]bool, len(requested))
	for _, value := range requested {
		provider, known := ports.ParseProviderID(value)
		if !known {
			return nil, fmt.Errorf("%w: unknown provider %q", ErrInvalidProviderSelection, value)
		}
		selected[provider] = false
	}
	filtered := make([]ports.JobSource, 0, len(sources))
	for _, source := range sources {
		provider := ports.CapabilitiesOf(source).Provider
		if _, wanted := selected[provider]; wanted {
			filtered = append(filtered, source)
			selected[provider] = true
		}
	}
	for _, value := range requested {
		provider, _ := ports.ParseProviderID(value)
		if !selected[provider] {
			return nil, fmt.Errorf("%w: provider %q is not configured", ErrInvalidProviderSelection, provider)
		}
	}
	return filtered, nil
}
