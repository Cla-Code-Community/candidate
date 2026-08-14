import { expect, it } from "vitest";
import type {
    GoScraperMocks,
    GoScraperValidResponse,
    SearchJobs,
} from "./goScraper.TC.types";

interface TC05Deps {
  searchJobs: SearchJobs;
  validResponse: GoScraperValidResponse;
  mocks: GoScraperMocks;
}

export function TC05({ searchJobs, validResponse, mocks }: TC05Deps) {
  it("deve enviar payload válido ao Go Scraper preservando keywords e localização", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validResponse,
    });

    await searchJobs({
      keywords: ["Java", " Java ", "Node.js"],
      location: "SP",
    });

    const firstCall = mocks.fetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(firstCall[1].body);
    expect(body.keywords).toEqual(["Java", " Java ", "Node.js"]);
    expect(body.location).toBe("SP");
  });
}
