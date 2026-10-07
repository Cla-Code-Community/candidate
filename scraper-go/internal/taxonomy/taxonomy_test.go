package taxonomy

import (
	"encoding/json"
	"os"
	"reflect"
	"regexp"
	"strings"
	"testing"
)

func TestCanonicalContractAndBackendSync(t *testing.T) {
	expected := []string{"backend", "frontend", "fullstack", "mobile", "data", "devops", "platform", "qa", "security", "product", "product_design", "software", "leadership"}
	families := Families()
	if len(families) != 13 || Version() != "v1" {
		t.Fatal("invalid contract")
	}
	seen := map[string]bool{}
	for i, f := range families {
		if f.ID != expected[i] || f.ID != strings.ToLower(f.ID) || seen[f.ID] || f.Label == "" {
			t.Fatal(f)
		}
		seen[f.ID] = true
	}
	raw, err := os.ReadFile("../../../backend/src/modules/jobs/types/professionalTaxonomy.ts")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`(?s)professionalFamilies = (\[.*?\]) as const`).FindSubmatch(raw)
	if len(match) != 2 {
		t.Fatal("missing backend contract")
	}
	var backend []Family
	if err := json.Unmarshal(match[1], &backend); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(families, backend) {
		t.Fatal("Go/backend taxonomy drift")
	}
	if !strings.Contains(string(raw), `taxonomyVersion = "`+Version()+`"`) {
		t.Fatal("version drift")
	}
}
func TestHistoricalNormalizationAndRelated(t *testing.T) {
	for raw, want := range map[string]string{" Backend ": "backend", "Dados": "data", "Infraestrutura": "devops", "other": "other", "unknown": "", "Full Stack": ""} {
		if Normalize(raw) != want {
			t.Fatal(raw)
		}
	}
	if IsPublic("other") || Label("other") != "" {
		t.Fatal("public other")
	}
	if !reflect.DeepEqual(Related("Backend", []string{"frontend", "other", "Frontend", "backend", "unknown", "data"}), []string{"frontend", "data"}) {
		t.Fatal("invalid related")
	}
	if len(Related("backend", nil)) != 0 {
		t.Fatal("invalid empty")
	}
}
