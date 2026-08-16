package linkedin

import (
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestNormalizeLinkedInLocation_UsaPaisDaBusca(t *testing.T) {
	req := domain.ScrapeRequest{SearchLocation: "Brasil"}

	assert.Equal(
		t,
		"São Paulo, Brasil",
		normalizeLinkedInLocation("São Paulo", req),
	)
	assert.Equal(
		t,
		"Brasil",
		normalizeLinkedInLocation("", req),
	)
	assert.Equal(
		t,
		"Rio de Janeiro, Brasil",
		normalizeLinkedInLocation("Rio de Janeiro, Brasil", req),
	)
	assert.Equal(
		t,
		"Miami, Flórida, Estados Unidos",
		normalizeLinkedInLocation("Miami, Flórida, Estados Unidos", req),
	)
}
