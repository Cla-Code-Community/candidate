import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ScraperAlreadyRunningError,
  scraperClient,
} from "../../../../src/modules/admin/scrapers/scraperClient";
import { ScrapersController } from "../../../../src/modules/admin/scrapers/scrapers.controller";
import { ScrapersService } from "../../../../src/modules/admin/scrapers/scrapers.service";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const req = {
  session: { userId: "admin-1", role: "admin" },
  headers: {},
  socket: { remoteAddress: "127.0.0.1" },
} as unknown as Request;

describe("scraperClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls trigger endpoint and returns json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        json: () => Promise.resolve({ ok: true, message: "started" }),
      }),
    );

    await expect(scraperClient.triggerScrape()).resolves.toEqual({
      ok: true,
      message: "started",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/scrape"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ScraperAlreadyRunningError for 409 responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ message: "busy" }),
      }),
    );

    await expect(scraperClient.triggerScrape()).rejects.toBeInstanceOf(
      ScraperAlreadyRunningError,
    );
  });

  it("throws generic errors for non-ok responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn(),
      }),
    );

    await expect(scraperClient.getStatus()).rejects.toThrow(
      "scraper respondeu HTTP 500",
    );
  });

  it("calls job read, count and reprocess endpoints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, jobs: [], total: 0 }),
      }),
    );

    await expect(scraperClient.getJobs()).resolves.toEqual({
      ok: true,
      jobs: [],
      total: 0,
    });
    await expect(scraperClient.getJobsCount()).resolves.toEqual({
      ok: true,
      jobs: [],
      total: 0,
    });
    await expect(scraperClient.reprocessJobs()).resolves.toEqual({
      ok: true,
      jobs: [],
      total: 0,
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/jobs"),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/count"),
      expect.any(Object),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/reprocess"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("ScrapersService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates read operations and builds admin scraper summary", async () => {
    vi.spyOn(scraperClient, "getStatus").mockResolvedValue({
      name: "linkedin",
      running: false,
      lastRunAt: "2026-07-02T10:00:00.000Z",
    });
    vi.spyOn(scraperClient, "getJobsCount").mockResolvedValue({ total: 9 });
    vi.spyOn(scraperClient, "getJobs").mockResolvedValue({ jobs: [], total: 0 });

    const service = new ScrapersService();

    await expect(service.getStatus()).resolves.toEqual(
      expect.objectContaining({ name: "linkedin" }),
    );
    await expect(service.getJobs()).resolves.toEqual({ jobs: [], total: 0 });
    await expect(service.listScrapers()).resolves.toEqual([
      {
        name: "linkedin",
        status: "idle",
        running: false,
        lastRunAt: "2026-07-02T10:00:00.000Z",
        jobsCollected: 9,
      },
    ]);
  });

  it("preserves already-running errors and wraps generic trigger failures", async () => {
    vi.spyOn(scraperClient, "triggerScrape").mockRejectedValueOnce(
      new ScraperAlreadyRunningError("busy"),
    );
    const service = new ScrapersService();
    await expect(service.triggerScrape()).rejects.toBeInstanceOf(
      ScraperAlreadyRunningError,
    );

    vi.spyOn(scraperClient, "triggerScrape").mockRejectedValueOnce(
      new Error("network"),
    );
    await expect(service.triggerScrape()).rejects.toThrow(
      "falha ao disparar o scraper",
    );
  });

  it("returns null jobsCollected when count fails", async () => {
    vi.spyOn(scraperClient, "getStatus").mockResolvedValue({ running: true });
    vi.spyOn(scraperClient, "getJobsCount").mockRejectedValue(new Error("down"));

    await expect(new ScrapersService().listScrapers()).resolves.toEqual([
      {
        name: "go-scraper",
        status: "running",
        running: true,
        lastRunAt: null,
        jobsCollected: null,
      },
    ]);
  });

  it("delegates reprocess jobs to scraper client", async () => {
    vi.spyOn(scraperClient, "reprocessJobs").mockResolvedValue({
      ok: true,
      message: "queued",
    });

    await expect(new ScrapersService().reprocessJobs()).resolves.toEqual({
      ok: true,
      message: "queued",
    });
  });
});

describe("ScrapersController", () => {
  const service = {
    triggerScrape: vi.fn(),
    getStatus: vi.fn(),
    listScrapers: vi.fn(),
    getJobs: vi.fn(),
    getJobsCount: vi.fn(),
    reprocessJobs: vi.fn(),
  };
  const auditService = { fromRequest: vi.fn() };
  const controller = new ScrapersController(service as any, auditService as any);

  beforeEach(() => {
    vi.clearAllMocks();
    service.triggerScrape.mockResolvedValue({ ok: true, message: "started" });
    service.getStatus.mockResolvedValue({ running: false });
    service.listScrapers.mockResolvedValue([{ name: "go-scraper", running: false }]);
    service.getJobs.mockResolvedValue({ jobs: [], total: 0 });
    service.getJobsCount.mockResolvedValue({ total: 0 });
    service.reprocessJobs.mockResolvedValue({ ok: true, message: "queued" });
  });

  it("triggers scraper with 202 and maps already running to 409", async () => {
    const res = response();
    await controller.trigger(req, res);

    expect(res.status).toHaveBeenCalledWith(202);
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "scrapers.trigger");

    service.triggerScrape.mockRejectedValueOnce(
      new ScraperAlreadyRunningError("busy"),
    );
    const conflictRes = response();
    await controller.trigger(req, conflictRes);
    expect(conflictRes.status).toHaveBeenCalledWith(409);
  });

  it("returns read endpoints and audits each read", async () => {
    await controller.status(req, response());
    await controller.list(req, response());
    await controller.listJobs(req, response());
    await controller.jobsCount(req, response());

    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "scrapers.read", {
      type: "scrapers",
      id: "status",
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "scrapers.read", {
      type: "scrapers",
      id: "list",
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "scrapers.read", {
      type: "scrapers",
      id: "jobs",
    });
    expect(auditService.fromRequest).toHaveBeenCalledWith(req, "scrapers.read", {
      type: "scrapers",
      id: "jobs-count",
    });
  });

  it("reprocesses jobs and maps failures to 500", async () => {
    await controller.reprocess(req, response());
    expect(auditService.fromRequest).toHaveBeenCalledWith(
      req,
      "scrapers.reprocess",
    );

    service.reprocessJobs.mockRejectedValueOnce(new Error("down"));
    const res = response();
    await controller.reprocess(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 for read endpoint failures", async () => {
    service.getStatus.mockRejectedValueOnce(new Error("down"));
    const res = response();

    await controller.status(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 for trigger, list, jobs and count failures", async () => {
    service.triggerScrape.mockRejectedValueOnce(new Error("down"));
    const triggerRes = response();
    await controller.trigger(req, triggerRes);
    expect(triggerRes.status).toHaveBeenCalledWith(500);

    service.listScrapers.mockRejectedValueOnce(new Error("down"));
    const listRes = response();
    await controller.list(req, listRes);
    expect(listRes.status).toHaveBeenCalledWith(500);

    service.getJobs.mockRejectedValueOnce(new Error("down"));
    const jobsRes = response();
    await controller.listJobs(req, jobsRes);
    expect(jobsRes.status).toHaveBeenCalledWith(500);

    service.getJobsCount.mockRejectedValueOnce(new Error("down"));
    const countRes = response();
    await controller.jobsCount(req, countRes);
    expect(countRes.status).toHaveBeenCalledWith(500);
  });
});
