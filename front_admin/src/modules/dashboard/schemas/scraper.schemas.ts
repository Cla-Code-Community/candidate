import z from "zod";

export const ScraperSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastRun: z.string(),
  collected24h: z.number().int().nonnegative(),
  active: z.boolean(),
});

export type ScraperSummary = z.infer<typeof ScraperSummarySchema>;
