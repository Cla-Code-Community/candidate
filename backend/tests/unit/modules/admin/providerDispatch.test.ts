import { afterEach, expect, it, vi } from "vitest";
import { scraperClient, ScraperInvalidSelectionError } from "../../../../src/modules/admin/scrapers/scraperClient";
import { ScrapersService } from "../../../../src/modules/admin/scrapers/scrapers.service";
import { ScrapersController } from "../../../../src/modules/admin/scrapers/scrapers.controller";
import type { Request, Response } from "express";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("forwards an individual ProviderID to Go without a global fallback", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, message: "started" }) });
  vi.stubGlobal("fetch", fetch);
  await new ScrapersService().triggerScraper("greenhouse");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ sources: ["greenhouse"] });
});

it("preserves a Go rejection when the provider is disabled", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: "provider is not configured" }) }));
  await expect(new ScrapersService().triggerScraper("greenhouse")).rejects.toBeInstanceOf(ScraperInvalidSelectionError);
});

it("rejects invalid selection before sending any request to Go", async () => {
  const trigger = vi.spyOn(scraperClient, "triggerScrape");
  const service = new ScrapersService();
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const controller = new ScrapersController(service, { fromRequest: vi.fn() } as never);
  await controller.trigger({ body: { sources: ["unknown"] } } as Request, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(trigger).not.toHaveBeenCalled();
});
