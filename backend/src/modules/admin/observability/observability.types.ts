import { z } from "zod";

// --- HealthStatus ---
export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// --- ServiceHealth ---
export const ServiceHealthSchema = z.object({
  status: HealthStatusSchema,
  latencyMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

// --- HealthcheckResult ---
export const HealthcheckResultSchema = z.object({
  status: HealthStatusSchema, // status agregado — pior entre todos os serviços
  timestamp: z
    .string()
    .datetime({ message: "Timestamp inválido no formato ISO 8601" }),
  services: z.object({
    postgres: ServiceHealthSchema,
    valkey: ServiceHealthSchema,
    scraper: ServiceHealthSchema,
  }),
});
export type HealthcheckResult = z.infer<typeof HealthcheckResultSchema>;

// --- MetricSnapshot ---
export const MetricSnapshotSchema = z.object({
  requestRatePerMinute: z.number().nonnegative().nullable(),
  errorRatePct: z.number().min(0).max(100).nullable(),
  p95LatencyMs: z.number().nonnegative().nullable(),
  cacheHitRatePct: z.number().min(0).max(100).nullable(),
  activeSessionsCount: z.number().int().nonnegative().nullable(),
});
export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

export const ObservabilityPointSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number().nullable(),
});
export type ObservabilityPoint = z.infer<typeof ObservabilityPointSchema>;

export const ObservabilitySeriesSchema = z.object({
  label: z.string(),
  points: z.array(ObservabilityPointSchema),
});
export type ObservabilitySeries = z.infer<typeof ObservabilitySeriesSchema>;

export const ObservabilityPanelSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  unit: z.enum(["none", "percent", "ms", "bytes", "seconds", "count"]),
  visualization: z.enum(["stat", "line"]),
  series: z.array(ObservabilitySeriesSchema),
});
export type ObservabilityPanel = z.infer<typeof ObservabilityPanelSchema>;

export const ObservabilityDashboardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  panels: z.array(ObservabilityPanelSchema),
});
export type ObservabilityDashboard = z.infer<
  typeof ObservabilityDashboardSchema
>;

export const ObservabilityDashboardsSchema = z.object({
  range: z.string(),
  step: z.string(),
  generatedAt: z.string().datetime(),
  dashboards: z.array(ObservabilityDashboardSchema),
});
export type ObservabilityDashboards = z.infer<
  typeof ObservabilityDashboardsSchema
>;

// --- ObservabilityOverview ---
export const ObservabilityOverviewSchema = z.object({
  health: HealthcheckResultSchema,
  metrics: MetricSnapshotSchema,
});
export type ObservabilityOverview = z.infer<typeof ObservabilityOverviewSchema>;

// Processor-owned runtime state. Unknown fields are stripped before forwarding,
// so an internal response cannot expose credentials or incidental payloads.
const nullableTimestamp = z.string().datetime().nullable();
export const ProcessorSnapshotSchema = z.object({
  status: z.enum(["ok", "partial"]),
  timestamp: z.string().datetime(),
  execution: z.object({
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
  lock: z.object({ held: z.boolean(), ttlSeconds: z.number().nonnegative() }),
  concurrency: z.object({
    configured: z.number().int().nonnegative(),
    effective: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    waiting: z.number().int().nonnegative(),
  }),
  progress: z.object(
    Object.fromEntries(
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
      ].map((k) => [k, z.number().int().nonnegative()]),
    ),
  ),
  queues: z.object(
    Object.fromEntries(
      ["collection", "classification", "persistence", "indexing"].map((k) => [
        k,
        z.object({
          depth: z.number().int().nonnegative(),
          capacity: z.number().int().nonnegative(),
        }),
      ]),
    ),
  ),
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
