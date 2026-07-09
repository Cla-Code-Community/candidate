import { z } from "zod";

export const ObservabilityMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  note: z.string(),
  tone: z.enum(["success", "warning", "danger"]),
});

export const InfraUsageSchema = z.object({
  label: z.string(),
  valueLabel: z.string(),
  percentage: z.number().min(0).max(100),
  color: z.string(),
});

export type ObservabilityMetric = z.infer<typeof ObservabilityMetricSchema>;

export type InfraUsage = z.infer<typeof InfraUsageSchema>;
