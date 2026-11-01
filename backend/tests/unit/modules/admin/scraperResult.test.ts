import { expect, it } from "vitest";
import { ScraperStatusSchema } from "../../../../src/modules/admin/scrapers/scrapers.types";

it("retains partial execution counts and accepts an empty initial history", () => {
  expect(ScraperStatusSchema.parse({ running: false, lastRunAt: null, lastRun: null }).lastRun).toBeNull();
  const result = ScraperStatusSchema.parse({
    running: false,
    lastRunAt: "2026-11-01T00:00:00Z",
    jobsCollected: 210,
    lastRun: { runId: "test", status: "partial", finishedAt: "2026-11-01T00:00:00Z", jobsSaved: 210, jobsIndexed: 210, errorType: "timeout" },
  });
  expect(result.lastRun?.status).toBe("partial");
  expect(result.lastRun?.jobsIndexed).toBe(210);
});
