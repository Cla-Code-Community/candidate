import { z } from "zod";

export const MetricValueSchema = z.object({
  value: z.number(),
  trend: z.string(),
  positive: z.boolean(),
});

export const DashboardStatsSchema = z.object({
  totalUsers: MetricValueSchema,
  activeUsers: MetricValueSchema,
  totalJobs: MetricValueSchema,
  jobsToday: MetricValueSchema,
});

export const ResourceUsageSchema = z.object({
  scraper: z.number(),
  postgres: z.number(),
  valkey: z.number(),
});

export const DashboardChartPointSchema = z.object({
  timestamp: z.string(),
  label: z.string(),
  totalJobs: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
});

export type MetricValue = z.infer<typeof MetricValueSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type ResourceUsage = z.infer<typeof ResourceUsageSchema>;
export type DashboardChartPoint = z.infer<typeof DashboardChartPointSchema>;
