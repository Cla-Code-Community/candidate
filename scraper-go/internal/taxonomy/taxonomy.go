// Package taxonomy owns the public professional-family contract.
package taxonomy

import (
	_ "embed"
	"encoding/json"
	"strings"
)

//go:embed families.json
var contractJSON []byte

type Family struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}
type Contract struct {
	Version  string            `json:"taxonomyVersion"`
	Families []Family          `json:"families"`
	Aliases  map[string]string `json:"historicalAliases"`
}

var contract = load()

func load() Contract {
	var c Contract
	if err := json.Unmarshal(contractJSON, &c); err != nil {
		panic(err)
	}
	return c
}
func Version() string    { return contract.Version }
func Families() []Family { return append([]Family(nil), contract.Families...) }
func IsPublic(id string) bool {
	for _, f := range contract.Families {
		if f.ID == id {
			return true
		}
	}
	return false
}

// Normalize accepts canonical casing and only documented historical aliases.
// Unknown values remain unknown; they never become software.
func Normalize(value string) string {
	id := strings.ToLower(strings.TrimSpace(value))
	if alias, ok := contract.Aliases[id]; ok {
		id = alias
	}
	if IsPublic(id) || id == "other" {
		return id
	}
	return ""
}
func Label(id string) string {
	for _, f := range contract.Families {
		if f.ID == id {
			return f.Label
		}
	}
	return ""
}

// Related uses canonical presentation order, independently of input/map order.
func Related(primary string, values []string) []string {
	seen := make(map[string]bool)
	for _, value := range values {
		id := Normalize(value)
		if IsPublic(id) && id != Normalize(primary) {
			seen[id] = true
		}
	}
	result := make([]string, 0, len(seen))
	for _, f := range contract.Families {
		if seen[f.ID] {
			result = append(result, f.ID)
		}
	}
	return result
}
