import { z } from "zod";
import { LogEntrySchema, ScraperSchema } from "./scraper.schema";

export const ScrapersOverviewSchema = z.object({
  scrapers: z.array(ScraperSchema),
  logs: z.array(LogEntrySchema),
});

export type ScrapersOverview = z.infer<typeof ScrapersOverviewSchema>;
