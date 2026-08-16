import { expect, it } from "vitest";
import type {
    GoScraperMocks,
    GoScraperValidParams,
    SearchJobs,
} from "./goScraper.TC.types";

interface TC02Deps {
  searchJobs: SearchJobs;
  validParams: GoScraperValidParams;
  mocks: GoScraperMocks;
}

export function TC02({ searchJobs, validParams, mocks }: TC02Deps) {
  it("deve falhar quando o Go Scraper responder com status de erro", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(searchJobs(validParams)).rejects.toThrow(
      "Go scraper: 500 Internal Server Error",
    );
  });
}
