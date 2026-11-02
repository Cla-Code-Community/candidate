package config

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"
	_ "time/tzdata" // Runtime images need not install the IANA timezone database.

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

const ProviderWindowsEnv = "SCRAPER_PROVIDER_WINDOWS"
const ProviderScheduleTimezoneEnv = "SCRAPER_SCHEDULE_TIMEZONE"
const ProviderSchedulePreset = "pav178"
const ProviderScheduleTimezone = "America/Sao_Paulo"

// ProviderWindow uses civil minutes in Timezone. An empty timezone retains UTC.
// Overnight windows must be split explicitly. ID is stable across config ordering.
type ProviderWindow struct {
	Provider ports.ProviderID `json:"provider"`
	Start    int              `json:"-"`
	End      int              `json:"-"`
	ID       string           `json:"id"`
	Timezone string           `json:"timezone"`
}

func (w ProviderWindow) WindowID() string {
	if w.ID != "" {
		return w.ID
	}
	return fmt.Sprintf("%s-%02d%02d", w.Provider, w.Start/60, w.Start%60)
}

func (w ProviderWindow) Location() *time.Location {
	if w.Timezone == "" || w.Timezone == "UTC" {
		return time.UTC
	}
	loc, err := time.LoadLocation(w.Timezone)
	if err != nil {
		panic("provider window timezone was not validated: " + w.Timezone)
	}
	return loc
}

// Preserve legacy UTC response fields and expose unambiguous local fields.
func (w ProviderWindow) MarshalJSON() ([]byte, error) {
	value := map[string]any{"provider": w.Provider, "id": w.WindowID(), "timezone": w.Location().String()}
	if w.Location() == time.UTC {
		value["startMinuteUTC"], value["endMinuteUTC"] = w.Start, w.End
	} else {
		value["startMinuteLocal"], value["endMinuteLocal"] = w.Start, w.End
	}
	return json.Marshal(value)
}

func ParseProviderWindows(value string) ([]ProviderWindow, error) {
	return ParseProviderWindowsInTimezone(value, "")
}

// Custom syntax: [window-id@]provider=HH:MM-HH:MM. The preset is opt-in;
// neither an empty configuration nor this parser enables the scheduler.
func ParseProviderWindowsInTimezone(value, timezone string) ([]ProviderWindow, error) {
	if strings.TrimSpace(value) == ProviderSchedulePreset {
		if timezone != "" && timezone != ProviderScheduleTimezone {
			return nil, fmt.Errorf("%s: preset requires %s", ProviderScheduleTimezoneEnv, ProviderScheduleTimezone)
		}
		timezone = ProviderScheduleTimezone
		value = strings.Join([]string{
			"greenhouse-1@greenhouse=00:00-01:00", "gupy-1@gupy=01:00-02:00",
			"inhire-1@inhire=02:00-03:00", "linkedin-1@linkedin=03:00-04:00",
			"adzuna-1@adzuna=04:00-05:00", "lever-1@lever=05:00-06:00",
			"greenhouse-2@greenhouse=06:00-07:00", "gupy-2@gupy=07:00-08:00",
			"inhire-2@inhire=08:00-09:00", "linkedin-2@linkedin=09:00-10:00",
			"themuse-1@themuse=10:00-11:00", "greenhouse-3@greenhouse=11:00-12:00",
			"gupy-3@gupy=12:00-13:00", "inhire-3@inhire=13:00-14:00",
			"adzuna-2@adzuna=14:00-15:00", "lever-2@lever=15:00-16:00",
			"linkedin-3@linkedin=16:00-17:00", "greenhouse-4@greenhouse=17:00-18:00",
			"gupy-4@gupy=18:00-19:00", "inhire-4@inhire=19:00-20:00",
			"jooble-1@jooble=20:00-21:00",
		}, ",")
	}
	if timezone == "" {
		timezone = "UTC"
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		return nil, fmt.Errorf("%s: %w", ProviderScheduleTimezoneEnv, err)
	}
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	var windows []ProviderWindow
	for _, entry := range strings.Split(value, ",") {
		parts := strings.Split(strings.TrimSpace(entry), "=")
		if len(parts) != 2 {
			return nil, fmt.Errorf("%s: expected provider=HH:MM-HH:MM", ProviderWindowsEnv)
		}
		identity := strings.Split(strings.TrimSpace(parts[0]), "@")
		if len(identity) > 2 {
			return nil, fmt.Errorf("%s: invalid window identity", ProviderWindowsEnv)
		}
		id := ""
		if len(identity) == 2 {
			id = identity[0]
			if !windowIDPattern.MatchString(id) {
				return nil, fmt.Errorf("%s: invalid window ID %q", ProviderWindowsEnv, id)
			}
		}
		provider, known := ports.ParseProviderID(identity[len(identity)-1])
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
		windows = append(windows, ProviderWindow{Provider: provider, Start: start, End: end, ID: id, Timezone: timezone})
	}
	ids := make(map[string]bool)
	for _, w := range windows {
		if ids[w.WindowID()] {
			return nil, fmt.Errorf("%s: duplicate window ID %q", ProviderWindowsEnv, w.WindowID())
		}
		ids[w.WindowID()] = true
	}
	sort.Slice(windows, func(i, j int) bool { return windows[i].Start < windows[j].Start })
	for i := 1; i < len(windows); i++ {
		if windows[i].Start < windows[i-1].End {
			return nil, fmt.Errorf("%s: overlapping windows", ProviderWindowsEnv)
		}
	}
	return windows, nil
}

var windowIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)
