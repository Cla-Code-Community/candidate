import { ScraperJobsCountResponseSchema } from "./types";
import { api } from "./client";
import type {
  ScraperJobsCountResponse,
  ScraperJobsResponse,
  ScrapersListResponse,
  ScraperStatus,
} from "./types";

export const scrapersApi = {
  list: (signal?: AbortSignal) => api.get<ScrapersListResponse>("/admin/scrapers", { signal }),
  status: () => api.get<ScraperStatus>("/admin/scrapers/status"),
  jobs: (limit = 200, signal?: AbortSignal) =>
    api.get<ScraperJobsResponse>(`/admin/scrapers/jobs?limit=${limit}`, { signal }),
  jobsCount: async (signal?: AbortSignal) =>
    ScraperJobsCountResponseSchema.parse(await api.get<ScraperJobsCountResponse>("/admin/scrapers/jobs/count", { signal })),
  trigger: () => api.post<{ ok: boolean; message: string }>("/admin/scrapers/run"),
  triggerOne: (id: string) =>
    api.post<{ ok: boolean; message: string; scraper?: string }>(
      `/admin/scrapers/${encodeURIComponent(id)}/run`,
    ),
  clearJobsCache: () =>
    api.delete<{ ok: boolean; deleted: number; patterns: string[] }>(
      "/admin/jobs/cache",
    ),
};
