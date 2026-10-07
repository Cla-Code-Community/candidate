import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObservabilityService } from "../../../../src/modules/admin/observability/observability.service";
import { ProcessorSnapshotSchema } from "../../../../src/modules/admin/observability/observability.types";
vi.mock("../../../../src/modules/admin/observability/health.service", () => ({
  HealthService: class {},
}));
vi.mock("../../../../src/modules/admin/observability/metrics.service", () => ({
  MetricsService: class {},
}));
const now = "2026-10-07T00:00:00.000Z";
const fixture = {
  status: "ok",
  timestamp: now,
  execution: {
    status: "idle",
    source: null,
    startedAt: null,
    durationSeconds: 0,
    finishedAt: null,
    lastDurationSeconds: 0,
    lastStatus: null,
    nextRunAt: null,
    stage: null,
    applicationVersion: "test",
    taxonomyVersion: "v1",
  },
  lock: { held: false, ttlSeconds: 0 },
  concurrency: { configured: 12, effective: 0, active: 0, waiting: 0 },
  progress: Object.fromEntries(
    [
      "providersTotal",
      "providersCompleted",
      "adaptersTotal",
      "adaptersProcessed",
      "tasksTotal",
      "tasksCompleted",
      "tasksCanceled",
      "keywordsTotal",
      "keywordsProcessed",
      "batchesCompleted",
    ].map((k) => [k, 0]),
  ),
  queues: Object.fromEntries(
    ["collection", "classification", "persistence", "indexing"].map((k) => [
      k,
      { depth: 0, capacity: 0 },
    ]),
  ),
  resources: {
    cpuSeconds: 0,
    cpuPercent: null,
    memoryBytes: null,
    heapBytes: 0,
    goroutines: 1,
    gomaxprocs: 2,
    gomemlimitBytes: 1500,
  },
  errors: { total: 0, timeouts: 0 },
  rejectedTitles: [],
  rejectedTitlesSince: now,
  dependencies: { postgres: { status: "ok" }, valkey: { status: "ok" } },
  index: {
    activeVersion: "bootstrap",
    rebuildProgress: null,
    maintenance: null,
  },
};
describe("operational snapshot partial availability", () => {
  beforeEach(() => vi.unstubAllGlobals());
  it("returns idle without history and makes only one bounded call", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => fixture });
    vi.stubGlobal("fetch", fetch);
    const result = await new ObservabilityService(
      {} as any,
      {} as any,
    ).getOperationalSnapshot();
    expect(result.status).toBe("ok");
    expect(result.processor?.execution.status).toBe("idle");
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("preserves partial running state and strips secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...fixture,
          status: "partial",
          token: "secret",
          execution: {
            ...fixture.execution,
            status: "running",
            source: "cron",
            startedAt: now,
            stage: "classification",
          },
          dependencies: {
            postgres: { status: "down", error: "password secret" },
            valkey: { status: "ok" },
          },
        }),
      }),
    );
    const result = await new ObservabilityService(
      {} as any,
      {} as any,
    ).getOperationalSnapshot();
    expect(result.status).toBe("partial");
    expect(result.processor?.execution.status).toBe("running");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it.each(["timeout", "unavailable", "invalid"])(
    "returns partial for %s",
    async (kind) => {
      const fetch = vi.fn();
      if (kind === "invalid")
        fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ token: "secret" }),
        });
      else fetch.mockRejectedValue(new Error(kind));
      vi.stubGlobal("fetch", fetch);
      expect(
        await new ObservabilityService(
          {} as any,
          {} as any,
        ).getOperationalSnapshot(),
      ).toMatchObject({
        status: "partial",
        processor: null,
        availability: { scraper: "down" },
      });
    },
  );
  it("validates the last execution, progress, resources and lock contract", () => {
    const result = ProcessorSnapshotSchema.parse({
      ...fixture,
      execution: {
        ...fixture.execution,
        status: "completed",
        lastStatus: "success",
        finishedAt: now,
        lastDurationSeconds: 12,
      },
      lock: { held: true, ttlSeconds: 90 },
    });
    expect(result.execution.lastStatus).toBe("success");
    expect(result.lock.held).toBe(true);
    expect(result.progress.tasksTotal).toBe(0);
  });
});

it("honors the internal deadline signal and returns partial after abort", async () => {
  const controller = new AbortController();
  const timeout = vi
    .spyOn(AbortSignal, "timeout")
    .mockReturnValue(controller.signal);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init.signal.addEventListener("abort", () =>
            reject(init.signal.reason),
          ),
        ),
    ),
  );
  const pending = new ObservabilityService(
    {} as any,
    {} as any,
  ).getOperationalSnapshot();
  controller.abort();
  expect(await pending).toMatchObject({ status: "partial", processor: null });
  expect(timeout).toHaveBeenCalledWith(2500);
  timeout.mockRestore();
  vi.unstubAllGlobals();
});
