import { z } from "zod";

export const ScraperSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastRun: z.string(),
  indexedJobs: z.number().int().nonnegative(),
  active: z.boolean(),
  sla: z.string(),
});

export const ScraperAdapterSchema = z.object({
  name: z.string(),
  jobs: z.number().int().nonnegative(),
  sources: z.number().int().nonnegative(),
  configuredSources: z.number().int().nonnegative(),
  keywords: z.number().int().nonnegative(),
  sampleTitle: z.string().optional(),
});

export const ScraperJobPreviewSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  source: z.string(),
  keyword: z.string(),
  postedAt: z.string().optional(),
  url: z.string(),
});

export const ScraperOverviewSchema = z.object({
  indexedJobs: z.number().int().nonnegative(),
  loadedJobs: z.number().int().nonnegative(),
  adaptersCount: z.number().int().nonnegative(),
  sourcesCount: z.number().int().nonnegative(),
  configuredSourcesCount: z.number().int().nonnegative(),
  keywordsCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  totalScrapers: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().nullable(),
});

export const LogEntrySchema = z.object({
  time: z.string(),
  text: z.string(),
});

export type Scraper = z.infer<typeof ScraperSchema>;
export type ScraperAdapter = z.infer<typeof ScraperAdapterSchema>;
export type ScraperJobPreview = z.infer<typeof ScraperJobPreviewSchema>;
export type ScraperOverview = z.infer<typeof ScraperOverviewSchema>;

export type LogEntry = z.infer<typeof LogEntrySchema>;
