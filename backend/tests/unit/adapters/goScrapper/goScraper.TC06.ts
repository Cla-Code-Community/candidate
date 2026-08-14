import { expect, it, vi } from "vitest";
import type {
    GoScraperMocks,
    GoScraperValidParams,
    GoScraperValidResponse,
} from "./goScraper.TC.types";

interface TC06Deps {
  validParams: GoScraperValidParams;
  validResponse: GoScraperValidResponse;
  mocks: GoScraperMocks;
}

export function TC06({ validParams, validResponse, mocks }: TC06Deps) {
  it("deve usar GO_SCRAPER_URL do ambiente ao montar a URL de scrape", async () => {
    const previousGoScraperUrl = process.env.GO_SCRAPER_URL;
    process.env.GO_SCRAPER_URL = "http://custom-go:9999";
    vi.resetModules();

    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validResponse,
    });

    const { searchJobs: searchJobsFresh } =
      await import("../../../../src/adapters/goScraper.ts");
    await searchJobsFresh(validParams);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "http://custom-go:9999/scrape",
      expect.anything(),
    );

    if (previousGoScraperUrl === undefined) {
      delete process.env.GO_SCRAPER_URL;
    } else {
      process.env.GO_SCRAPER_URL = previousGoScraperUrl;
    }
    vi.resetModules();
  });
}
