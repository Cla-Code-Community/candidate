import { z } from "zod";
import { HealthcheckResultSchema } from "../observability/observability.types";

export const DashboardStatsSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  totalCollectedJobs: z.number().int().nonnegative(),
  jobsCollectedToday: z.number().int().nonnegative(),
});

export const DashboardScraperStatusSchema = z.object({
  name: z.string(),
  status: z.enum(["running", "idle", "down", "unknown"]),
  running: z.boolean(),
  lastRunAt: z.string().nullable(),
  jobsCollected: z.number().int().nonnegative().nullable(),
});

export const DashboardOverviewSchema = z.object({
  stats: DashboardStatsSchema,
  scrapers: z.array(DashboardScraperStatusSchema),
  services: HealthcheckResultSchema,
  generatedAt: z.string().datetime(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardScraperStatus = z.infer<
  typeof DashboardScraperStatusSchema
>;
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;
