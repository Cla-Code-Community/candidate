import { describe, expect, it } from "vitest";
import {
  LogEntrySchema,
  ScraperAdapterSchema,
  ScraperJobPreviewSchema,
  ScraperOverviewSchema,
  ScraperSchema,
} from "../../../../src/modules/scrapers/schemas/scraper.schema";
import { ScrapersOverviewSchema } from "../../../../src/modules/scrapers/schemas/scraperOverview.schema";

describe("scraper schemas", () => {
  it("validates scraper overview structures", () => {
    const scraper = ScraperSchema.parse({
      id: "lever",
      name: "Lever",
      status: "Ocioso",
      lastRun: "Sem execucao",
      indexedJobs: 20,
      active: false,
      sla: "Operacional",
    });

    expect(
      ScrapersOverviewSchema.parse({
        scrapers: [scraper],
        logs: [LogEntrySchema.parse({ time: "12:00:00", text: "ok" })],
      }).scrapers[0].name,
    ).toBe("Lever");
  });

  it("validates adapter, job preview and aggregate values", () => {
    expect(
      ScraperAdapterSchema.parse({
        name: "Adzuna",
        jobs: 1,
        sources: 1,
        configuredSources: 1,
        keywords: 1,
        sampleTitle: "Frontend",
      }).sampleTitle,
    ).toBe("Frontend");

    expect(
      ScraperJobPreviewSchema.parse({
        id: "job1",
        title: "Dev",
        company: "Cand",
        location: "Remoto",
        source: "Adzuna",
        keyword: "react",
        url: "https://example.com",
      }).keyword,
    ).toBe("react");

    expect(() =>
      ScraperOverviewSchema.parse({
        indexedJobs: -1,
        loadedJobs: 1,
        adaptersCount: 1,
        sourcesCount: 1,
        configuredSourcesCount: 1,
        keywordsCount: 1,
        runningCount: 1,
        totalScrapers: 1,
        lastUpdatedAt: null,
      }),
    ).toThrow();
  });
});
