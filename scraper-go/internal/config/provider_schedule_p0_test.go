package config

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProviderSchedulePresetHas21IndependentWindows(t *testing.T) {
	windows, err := ParseProviderWindows(ProviderSchedulePreset)
	require.NoError(t, err)
	require.Len(t, windows, 21)
	counts := map[string]int{}
	ids := map[string]bool{}
	expected := []string{"greenhouse", "gupy", "inhire", "linkedin", "adzuna", "lever", "greenhouse", "gupy", "inhire", "linkedin", "themuse", "greenhouse", "gupy", "inhire", "adzuna", "lever", "linkedin", "greenhouse", "gupy", "inhire", "jooble"}
	for i, w := range windows {
		require.Equal(t, expected[i], string(w.Provider))
		require.Equal(t, i*60, w.Start)
		require.Equal(t, (i+1)*60, w.End)
		require.Equal(t, ProviderScheduleTimezone, w.Location().String())
		require.Equal(t, string(w.Provider) == "greenhouse", w.GreenhouseFixedGroup)
		require.Equal(t, string(w.Provider) == "linkedin" || string(w.Provider) == "adzuna", w.FullKeywordCoverage)
		require.False(t, ids[w.WindowID()])
		ids[w.WindowID()] = true
		counts[string(w.Provider)]++
	}
	require.Equal(t, map[string]int{"greenhouse": 4, "gupy": 4, "inhire": 4, "linkedin": 3, "adzuna": 2, "lever": 2, "themuse": 1, "jooble": 1}, counts)
	values := map[string]string{ProviderWindowsEnv: ProviderSchedulePreset}
	cfg, err := LoadRuntimeConfigFromLookup(func(k string) (string, bool) { v, ok := values[k]; return v, ok })
	require.NoError(t, err)
	require.Equal(t, windows, cfg.ProviderWindows)
	defaults, err := LoadRuntimeConfigFromLookup(func(string) (string, bool) { return "", false })
	require.NoError(t, err)
	require.Empty(t, defaults.ProviderWindows)
	custom, err := ParseProviderWindowsInTimezone("greenhouse-1@greenhouse=00:00-01:00", ProviderScheduleTimezone)
	require.NoError(t, err)
	require.False(t, custom[0].GreenhouseFixedGroup)
	custom, err = ParseProviderWindowsInTimezone("linkedin-1@linkedin=03:00-04:00", ProviderScheduleTimezone)
	require.NoError(t, err)
	require.False(t, custom[0].FullKeywordCoverage)
}

func TestProviderWindowIDsAreStableAndTimezoneIsExplicit(t *testing.T) {
	a, err := ParseProviderWindows("gupy=01:00-02:00,gupy=03:00-04:00")
	require.NoError(t, err)
	b, err := ParseProviderWindows("gupy=03:00-04:00,gupy=01:00-02:00")
	require.NoError(t, err)
	require.Equal(t, a, b)
	require.NotEqual(t, a[0].WindowID(), a[1].WindowID())
	local, err := ParseProviderWindowsInTimezone("gupy-1@gupy=23:00-24:00", ProviderScheduleTimezone)
	require.NoError(t, err)
	require.Equal(t, "gupy-1", local[0].WindowID())
	utcJSON, err := json.Marshal(a[0])
	require.NoError(t, err)
	require.Contains(t, string(utcJSON), `"startMinuteUTC":60`)
	localJSON, err := json.Marshal(local[0])
	require.NoError(t, err)
	require.Contains(t, string(localJSON), `"startMinuteLocal":1380`)
	require.NotContains(t, string(localJSON), "startMinuteUTC")
}

func TestProviderScheduleRejectsDuplicateIDsInvalidTimezoneAndOverlap(t *testing.T) {
	for _, value := range []string{
		"same@gupy=01:00-02:00,same@linkedin=03:00-04:00",
		"@gupy=01:00-02:00", "bad/id@gupy=01:00-02:00",
		"a@b@gupy=01:00-02:00", "a@gupy=01:00-03:00,b@gupy=02:00-04:00",
	} {
		_, err := ParseProviderWindows(value)
		require.Error(t, err, value)
	}
	_, err := ParseProviderWindowsInTimezone("gupy=01:00-02:00", "Invalid/Zone")
	require.Error(t, err)
	_, err = ParseProviderWindowsInTimezone(ProviderSchedulePreset, "UTC")
	require.Error(t, err)
	values := map[string]string{ProviderWindowsEnv: "gupy=01:00-02:00", ProviderScheduleTimezoneEnv: ProviderScheduleTimezone}
	cfg, err := LoadRuntimeConfigFromLookup(func(k string) (string, bool) { v, ok := values[k]; return v, ok })
	require.NoError(t, err)
	require.Equal(t, ProviderScheduleTimezone, cfg.ProviderWindows[0].Timezone)
}
