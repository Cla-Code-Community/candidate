import { z } from "zod";

export const ScraperSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  lastRun: z.string(),
  catalogJobs: z.number().int().nonnegative().nullable(),
  active: z.boolean(),
  executionDetail: z.string().optional(),
  runDisabled: z.boolean().optional(),
  availability: z.string(),
});

export const ScraperAdapterSchema = z.object({
  name: z.string(),
  jobs: z.number().int().nonnegative(),
  sources: z.number().int().nonnegative(),
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
  catalogJobs: z.number().int().nonnegative().nullable(),
  loadedJobs: z.number().int().nonnegative().nullable(),
  adaptersCount: z.number().int().nonnegative().nullable(),
  sourcesCount: z.number().int().nonnegative().nullable(),
  configuredSourcesCount: z.number().int().nonnegative().nullable(),
  keywordsCount: z.number().int().nonnegative().nullable(),
  runningCount: z.number().int().nonnegative().nullable(),
  totalScrapers: z.number().int().nonnegative().nullable(),
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
