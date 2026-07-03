import {
  cacheAbsoluteSCard,
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
} from "../../../lib/cache";
import { HealthService } from "../observability/health.service";
import { ScrapersService } from "../scrapers/scrapers.service";
import type { DashboardOverview, DashboardScraperStatus } from "./dashboard.types";
import { DashboardRepository } from "./dashboard.repository";

const JOBS_INDEX_KEY = "scraper:jobs:index";

function isToday(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function getCollectedAt(job: unknown): unknown {
  if (!job || typeof job !== "object") return undefined;

  const data = job as Record<string, unknown>;
  return data.collectedAt ?? data.scrapedAt ?? data.cachedAt ?? data.createdAt;
}

export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly scrapersService: ScrapersService,
    private readonly healthService: HealthService,
  ) {}

  async getOverview(): Promise<DashboardOverview> {
    const [
      totalUsers,
      activeUsers,
      totalCollectedJobs,
      jobsCollectedToday,
      scraperStatus,
      health,
    ] = await Promise.all([
      this.repository.countUsers(),
      this.repository.countActiveUsers(),
      this.countCollectedJobs(),
      this.countJobsCollectedToday(),
      this.getScraperStatus(),
      this.healthService.getHealthcheck(),
    ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalCollectedJobs,
        jobsCollectedToday,
      },
      scrapers: [scraperStatus],
      services: health,
      generatedAt: new Date().toISOString(),
    };
  }

  private async countCollectedJobs(): Promise<number> {
    return cacheAbsoluteSCard(JOBS_INDEX_KEY);
  }

  private async countJobsCollectedToday(): Promise<number> {
    const ids = await cacheAbsoluteSMembers(JOBS_INDEX_KEY);
    const jobs = await cacheGetJobsByIds(ids);

    return jobs.filter((job) => isToday(getCollectedAt(job))).length;
  }

  private async getScraperStatus(): Promise<DashboardScraperStatus> {
    try {
      const [status, count] = await Promise.all([
        this.scrapersService.getStatus(),
        this.scrapersService.getJobsCount().catch(() => null),
      ]);

      return {
        name: status.name ?? "go-scraper",
        status: status.running ? "running" : "idle",
        running: status.running,
        lastRunAt: status.lastRunAt ?? null,
        jobsCollected: status.jobsCollected ?? count?.total ?? null,
      };
    } catch {
      return {
        name: "go-scraper",
        status: "down",
        running: false,
        lastRunAt: null,
        jobsCollected: null,
      };
    }
  }
}
