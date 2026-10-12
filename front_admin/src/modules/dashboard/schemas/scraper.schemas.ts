import z from "zod";

export const ScraperSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastRun: z.string(),
  catalogJobs: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
  executionDetail: z.string().optional(),
  runDisabled: z.boolean().optional(),
});

export type ScraperSummary = z.infer<typeof ScraperSummarySchema>;
