package lever

import (
	"net/http"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/testutil"
)

func testHTTPClient(fn testutil.RoundTripFunc) *http.Client {
	return testutil.HTTPClient(fn)
}

func testResponse(body string) *http.Response {
	return testutil.Response(body)
}
