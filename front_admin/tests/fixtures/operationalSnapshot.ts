import type { OperationalSnapshot } from "../../src/modules/observability/schemas/operationalSnapshot.schema";
const now = "2026-10-07T00:00:00.000Z";
export const processorFixture = {
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

export const operationalFixture = { status: "ok", timestamp: now, processor: processorFixture, availability: { scraper: "ok" } } as OperationalSnapshot;
