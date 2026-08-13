package keywords

import (
	"reflect"
	"testing"
)

func TestNormalizeKeywordsTrimsLowercasesAndDeduplicates(t *testing.T) {
	got := NormalizeKeywords([]string{" Go ", "go", "", " Node.js ", "NODE.js"})
	want := []string{"go", "node.js"}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("NormalizeKeywords() = %#v, want %#v", got, want)
	}
}
