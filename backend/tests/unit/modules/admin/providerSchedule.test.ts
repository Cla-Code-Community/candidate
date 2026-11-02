import { describe, expect, it } from "vitest";
import { ScraperStatusSchema } from "../../../../src/modules/admin/scrapers/scrapers.types";

describe("provider window status contract", () => {
  it("preserves legacy UTC windows and manual status responses", () => {
    expect(ScraperStatusSchema.parse({ running: false })).toEqual({ running: false });
    const window = { provider: "gupy", startMinuteUTC: 60, endMinuteUTC: 120 };
    expect(ScraperStatusSchema.parse({ running: false, providerWindows: [window] }).providerWindows).toEqual([window]);
  });

  it("preserves local window identity and timezone", () => {
    const window = { provider: "greenhouse", id: "greenhouse-1", timezone: "America/Sao_Paulo", startMinuteLocal: 0, endMinuteLocal: 60 };
    expect(ScraperStatusSchema.parse({ running: true, providerWindows: [window] }).providerWindows).toEqual([window]);
  });

  it("rejects incomplete local windows and invalid minute bounds", () => {
    for (const window of [
      { provider: "gupy", startMinuteLocal: 0, endMinuteLocal: 60 },
      { provider: "gupy", id: "gupy-1", timezone: "America/Sao_Paulo", startMinuteLocal: 1440, endMinuteLocal: 1500 },
    ]) {
      expect(ScraperStatusSchema.safeParse({ running: false, providerWindows: [window] }).success).toBe(false);
    }
  });
});
