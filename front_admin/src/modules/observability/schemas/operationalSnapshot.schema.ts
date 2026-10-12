import { z } from "zod";

// Mirror the existing administrative Processor contract.
const nullableTimestamp = z.string().datetime().nullable();
const runCount = z.number().int().nonnegative();
const ProviderStateSchema = z.object({
  id: z.enum(["linkedin", "adzuna", "themuse", "gupy", "inhire", "jooble", "greenhouse", "lever", "unknown"]),
  configuredConcurrency: runCount,
  active: runCount,
  waiting: runCount,
  tasksTotal: runCount,
  tasksCompleted: runCount,
  tasksFailed: runCount,
  tasksCanceled: runCount,
  jobsCollected: runCount,
  lastTaskStatus: z.enum(["success", "failed", "canceled", "timeout"]).nullable(),
  lastTaskFinishedAt: nullableTimestamp,
  lastTaskDurationSeconds: z.number().nonnegative().nullable(),
  lastErrorType: z.enum(["network", "timeout", "canceled", "rate_limit", "authentication", "parsing", "validation", "unknown"]).nullable(),
});
export const ProcessorSnapshotSchema = z.object({
  status: z.enum(["ok", "partial"]),
  timestamp: z.string().datetime(),
  execution: z.object({
    runId: z.string().min(1).max(128).nullable().optional().default(null),
    status: z.enum(["idle", "running", "canceling", "failed", "completed"]),
    source: z.enum(["manual", "cron"]).nullable(),
    startedAt: nullableTimestamp,
    durationSeconds: z.number().nonnegative(),
    finishedAt: nullableTimestamp,
    lastDurationSeconds: z.number().nonnegative(),
    lastStatus: z
      .enum(["success", "failed", "canceled", "skipped", "timeout"])
      .nullable(),
    nextRunAt: nullableTimestamp,
    stage: z
      .enum(["collection", "classification", "persistence", "indexing"])
      .nullable(),
    applicationVersion: z.string().max(128),
    taxonomyVersion: z.string().max(128),
  }),
  providers: z.array(ProviderStateSchema).max(9)
    .refine((providers) => new Set(providers.map((p) => p.id)).size === providers.length, "Providers duplicados")
    .nullable().optional().default(null),
  classification: z.object({ received: runCount, classified: runCount, approved: runCount, rejected: runCount, invalid: runCount }).nullable().optional().default(null),
  persistence: z.object({ received: runCount, inserted: runCount, updated: runCount, skipped: runCount, failed: runCount, failedBatches: runCount }).nullable().optional().default(null),
  lock: z.object({ held: z.boolean(), ttlSeconds: z.number().nonnegative() }),
  concurrency: z.object({
    configured: z.number().int().nonnegative(),
    effective: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
  }),
  progress: z.object({
    providersTotal: z.number().int().nonnegative(),
    providersCompleted: z.number().int().nonnegative(),
    adaptersTotal: z.number().int().nonnegative(),
    adaptersProcessed: z.number().int().nonnegative(),
    tasksTotal: z.number().int().nonnegative(),
    tasksCompleted: z.number().int().nonnegative(),
    tasksCanceled: z.number().int().nonnegative(),
    keywordsTotal: z.number().int().nonnegative(),
    keywordsProcessed: z.number().int().nonnegative(),
    batchesCompleted: z.number().int().nonnegative(),
  }),
  queues: z.object({
    collection: z.object({ depth: z.number().int().nonnegative(), capacity: z.number().int().nonnegative() }),
    classification: z.object({ depth: z.number().int().nonnegative(), capacity: z.number().int().nonnegative() }),
    persistence: z.object({ depth: z.number().int().nonnegative(), capacity: z.number().int().nonnegative() }),
    indexing: z.object({ depth: z.number().int().nonnegative(), capacity: z.number().int().nonnegative() }),
  }),
  resources: z.object({
    cpuSeconds: z.number().nonnegative(),
    cpuPercent: z.number().nonnegative().nullable(),
    memoryBytes: z.number().nonnegative().nullable(),
    heapBytes: z.number().nonnegative(),
    goroutines: z.number().int().nonnegative(),
    gomaxprocs: z.number().int().positive(),
    gomemlimitBytes: z.number().nonnegative(),
  }),
  errors: z.object({
    total: z.number().int().nonnegative(),
    timeouts: z.number().int().nonnegative(),
  }),
  rejectedTitles: z
    .array(
      z.object({
        title: z.string().max(100),
        count: z.number().int().nonnegative(),
        reasonCode: z.enum([
          "negative_title",
          "no_family_recognized",
          "insufficient_title_evidence",
        ]),
      }),
    )
    .max(10),
  rejectedTitlesSince: z.string().datetime(),
  dependencies: z.object({
    postgres: z.object({ status: z.enum(["ok", "down"]) }),
    valkey: z.object({ status: z.enum(["ok", "degraded", "down"]) }),
  }),
  index: z.object({
    activeVersion: z.string().max(128),
    rebuildProgress: z.number().int().nonnegative().nullable(),
    maintenance: z
      .object({
        operation: z.enum([
          "rebuild",
          "reconcile",
          "backfill",
          "reclassify",
          "expire",
          "rollback",
        ]),
        status: z.enum(["success", "failed", "canceled"]),
        durationSeconds: z.number().nonnegative(),
        finishedAt: z.string().datetime(),
        processed: z.number().int().nonnegative(),
        divergences: z.number().int().nonnegative(),
      })
      .nullable(),
  }),
});
export type ProcessorSnapshot = z.infer<typeof ProcessorSnapshotSchema>;

export const OperationalSnapshotSchema = z.object({
  status: z.enum(["ok", "partial"]),
  timestamp: z.string().datetime(),
  processor: ProcessorSnapshotSchema.nullable(),
  availability: z.object({ scraper: z.enum(["ok", "down"]) }),
});
export type OperationalSnapshot = z.infer<typeof OperationalSnapshotSchema>;
