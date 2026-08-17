import { api } from "./client";
import type {
  ScraperJobsCountResponse,
  ScraperJobsResponse,
  ScrapersListResponse,
  ScraperStatus,
} from "./types";

export const scrapersApi = {
  list: () => api.get<ScrapersListResponse>("/admin/scrapers"),
  status: () => api.get<ScraperStatus>("/admin/scrapers/status"),
  jobs: (limit = 200) =>
    api.get<ScraperJobsResponse>(`/admin/scrapers/jobs?limit=${limit}`),
  jobsCount: () =>
    api.get<ScraperJobsCountResponse>("/admin/scrapers/jobs/count"),
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
