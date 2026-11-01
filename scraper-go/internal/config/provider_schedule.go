package config

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

const ProviderWindowsEnv = "SCRAPER_PROVIDER_WINDOWS"

// ProviderWindow is a daily, non-overlapping UTC window. Overnight windows
// must be split explicitly; configuration never silently changes a timezone.
type ProviderWindow struct {
	Provider ports.ProviderID `json:"provider"`
	Start    int              `json:"startMinuteUTC"`
	End      int              `json:"endMinuteUTC"`
}

func ParseProviderWindows(value string) ([]ProviderWindow, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	var windows []ProviderWindow
	for _, entry := range strings.Split(value, ",") {
		parts := strings.Split(strings.TrimSpace(entry), "=")
		if len(parts) != 2 {
			return nil, fmt.Errorf("%s: expected provider=HH:MM-HH:MM", ProviderWindowsEnv)
		}
		provider, known := ports.ParseProviderID(parts[0])
		bounds := strings.Split(parts[1], "-")
		if !known || len(bounds) != 2 {
			return nil, fmt.Errorf("%s: invalid provider/window %q", ProviderWindowsEnv, entry)
		}
		parse := func(s string) (int, error) {
			if s == "24:00" {
				return 1440, nil
			}
			t, err := time.Parse("15:04", s)
			if err != nil {
				return 0, err
			}
			return t.Hour()*60 + t.Minute(), nil
		}
		start, e1 := parse(bounds[0])
		end, e2 := parse(bounds[1])
		if e1 != nil || e2 != nil || start >= end || start >= 1440 {
			return nil, fmt.Errorf("%s: invalid bounds %q", ProviderWindowsEnv, entry)
		}
		windows = append(windows, ProviderWindow{provider, start, end})
	}
	sort.Slice(windows, func(i, j int) bool { return windows[i].Start < windows[j].Start })
	for i := 1; i < len(windows); i++ {
		if windows[i].Start < windows[i-1].End {
			return nil, fmt.Errorf("%s: overlapping windows", ProviderWindowsEnv)
		}
	}
	return windows, nil
}
