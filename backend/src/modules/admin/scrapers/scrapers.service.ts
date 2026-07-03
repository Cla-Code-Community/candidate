import { ScraperAlreadyRunningError, scraperClient } from "./scraperClient";
import type {
  AdminScraper,
  GetJobsResult,
  JobsCountResult,
  ReprocessScrapeResult,
  ScraperStatus,
  TriggerScrapeResult,
} from "./scrapers.types";

export class ScrapersService {
  async triggerScrape(): Promise<TriggerScrapeResult> {
    try {
      return await scraperClient.triggerScrape();
    } catch (error) {
      if (error instanceof ScraperAlreadyRunningError) {
        // repropaga para o controller decidir o status HTTP (409)
        throw error;
      }
      throw new Error("falha ao disparar o scraper");
    }
  }

  async getStatus(): Promise<ScraperStatus> {
    return scraperClient.getStatus();
  }

  async listScrapers(): Promise<AdminScraper[]> {
    const status = await this.getStatus();
    const count = await this.getJobsCount().catch(() => null);

    return [
      {
        name: status.name ?? "go-scraper",
        status: status.running ? "running" : "idle",
        running: status.running,
        lastRunAt: status.lastRunAt ?? null,
        jobsCollected: status.jobsCollected ?? count?.total ?? null,
      },
    ];
  }

  async getJobs(): Promise<GetJobsResult> {
    return scraperClient.getJobs();
  }

  async getJobsCount(): Promise<JobsCountResult> {
    return scraperClient.getJobsCount();
  }

  async reprocessJobs(): Promise<ReprocessScrapeResult> {
    return scraperClient.reprocessJobs();
  }
}
