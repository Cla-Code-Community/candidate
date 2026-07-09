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
  jobs: () => api.get<ScraperJobsResponse>("/admin/scrapers/jobs"),
  jobsCount: () =>
    api.get<ScraperJobsCountResponse>("/admin/scrapers/jobs/count"),
  trigger: () => api.post<{ ok: boolean; message: string }>("/admin/scrapers/run"),
};
