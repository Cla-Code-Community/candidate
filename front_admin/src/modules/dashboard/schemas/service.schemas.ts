import z from "zod";

export const ServiceHealthSchema = z.object({
  name: z.string(),
  status: z.string(),
  sla: z.string(),
  health: z.enum(["ok", "degraded", "down"]).nullable(),
  tone: z.enum(["success", "warning", "danger", "neutral"]),
});

export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;
