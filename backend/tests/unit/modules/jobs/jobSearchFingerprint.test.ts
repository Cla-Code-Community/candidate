import { describe, expect, it } from "vitest";
import { jobSearchCacheKey } from "../../../../src/modules/jobs/cache/jobSearchFingerprint";
import { parseJobSearchQuery } from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";
const key = (
  query: Record<string, unknown>,
  pagination = { page: 1, limit: 20 },
  generation = "1",
  profile: unknown = null,
) =>
  jobSearchCacheKey(
    parseJobSearchQuery(query as never),
    pagination,
    generation,
    profile,
  );

describe("PAV-125 deterministic search fingerprint", () => {
  it.each([
    { family: "backend,fullstack" },
    { family: "fullstack,backend" },
    { family: ["backend", "fullstack"] },
    { family: ["fullstack,backend", "backend"], familyMode: "any" },
  ])("equivalent normalized families %j", (query) => {
    expect(key(query)).toBe(
      key({ family: "backend,fullstack", familyMode: "any" }),
    );
  });
  it("separates primary and any", () => {
    expect(key({ family: "backend", familyMode: "primary" })).not.toBe(
      key({ family: "backend" }),
    );
  });
  it.each([
    { keywords: "private search" },
    { technology: "go" },
    { company: "acme" },
    { type: "remoto" },
    { level: "senior" },
    { seniority: "senior" },
    { location: "private address" },
    { country: "Brasil" },
    { continent: "Europa" },
    { state: "SP" },
    { city: "São Paulo" },
    { contract: "pj" },
    { matchSort: "asc" },
    { matchSort: "desc" },
  ])("includes existing filter %j", (query) =>
    expect(key(query)).not.toBe(key({})),
  );
  it("includes page, limit, generation and ranking inputs", () => {
    const base = key({});
    expect(key({}, { page: 2, limit: 20 })).not.toBe(base);
    expect(key({}, { page: 1, limit: 21 })).not.toBe(base);
    expect(key({}, undefined, "2")).not.toBe(base);
    expect(key({}, undefined, "1", { skills: ["Figma"] })).not.toBe(base);
  });
  it("normalizes current aliases without exposing private values", () => {
    expect(key({ model: " remoto ", contractType: "PJ", sort: "desc" })).toBe(
      key({ type: "remoto", contract: "pj", matchSort: "desc" }),
    );
    const result = key(
      {
        keywords: "private@email.test",
        location: "Private address",
        company: "Acme",
      },
      undefined,
      "1",
      { userId: "sensitive-user" },
    );
    expect(result).toMatch(/^jobs:search:v2:[a-f0-9]{64}$/);
    for (const privateValue of [
      "private@email.test",
      "Private address",
      "Acme",
      "sensitive-user",
    ])
      expect(result).not.toContain(privateValue);
  });
});
