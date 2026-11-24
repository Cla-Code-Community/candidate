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

it.each(["success", "partial", "partial_success", "failed", "timeout", "canceled"] as const)(
  "preserva o status %s e os contadores retornados pelo Go",
  (status) => {
    const payload = {
      running: false,
      lastRun: {
        runId: "fixture-operational-result",
        providers: ["greenhouse"],
        status,
        finishedAt: "2026-11-12T20:00:00Z",
        jobsSaved: 210,
        jobsIndexed: 209,
        errorType: status === "partial" ? "timeout" : "",
      },
    };
    expect(ScraperStatusSchema.parse(payload)).toEqual(payload);
  },
);

it("continua rejeitando status desconhecido no resultado da coleta", () => {
  expect(ScraperStatusSchema.safeParse({
    running: false,
    lastRun: {
      runId: "fixture-invalid-result",
      status: "unknown",
      finishedAt: "2026-11-12T20:00:00Z",
      jobsSaved: 0,
      jobsIndexed: 0,
      errorType: "",
    },
  }).success).toBe(false);
});
