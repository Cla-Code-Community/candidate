import { expect, it } from "vitest";
import type {
    GoScraperMocks,
    GoScraperValidParams,
    GoScraperValidResponse,
    SearchJobs,
} from "./goScraper.TC.types";

interface TC01Deps {
  searchJobs: SearchJobs;
  validParams: GoScraperValidParams;
  validResponse: GoScraperValidResponse;
  mocks: GoScraperMocks;
}

export function TC01({ searchJobs, validParams, validResponse, mocks }: TC01Deps) {
  it("deve retornar vagas quando o Go Scraper responder com dados válidos", async () => {
    mocks.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => validResponse,
    });

    const result = await searchJobs(validParams);

    expect(result.total).toBe(validResponse.total);
    expect(result.jobs).toHaveLength(validResponse.jobs.length);
    expect(result.jobs[0]).toMatchObject({
      id: validResponse.jobs[0].id,
      title: validResponse.jobs[0].title,
      company: validResponse.jobs[0].company,
      location: validResponse.jobs[0].location,
      url: validResponse.jobs[0].url,
      source: validResponse.jobs[0].source,
    });
  });
}
