package greenhouse

import "testing"

func TestGreenhouseSourceIdentityUsesBoardTokenNotDisplayName(t *testing.T) {
	a := NewGreenhouse("stable-board", "Company Before Rename")
	b := NewGreenhouse("stable-board", "Company After Rename")
	if a.SourceName() == b.SourceName() {
		t.Fatal("fixture must rename display name")
	}
	if a.SourceID() != b.SourceID() || a.SourceID() != "stable-board" {
		t.Fatal("identity must remain the board token")
	}
	if NewGreenhouse("another-board", "Company Before Rename").SourceID() == a.SourceID() {
		t.Fatal("display names must not collapse different boards")
	}
}
