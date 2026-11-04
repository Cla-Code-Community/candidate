vi.mock("../../../../src/modules/jobs/repositories/valkeyJobSearch.adapter", () => ({ openIndexedSearch: vi.fn().mockResolvedValue(null), hasActiveJobIndex: vi.fn().mockResolvedValue(false) }));
vi.mock("../../../../src/modules/jobs/cache/valkeySearchCache.adapter", () => ({ searchPageCache: {search: async (_f: unknown, _p: unknown, _r: unknown, query: () => Promise<unknown>) => query()} }));
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../../src/logger", () => ({ logger: { info: vi.fn() } }));
import { logger } from "../../../../src/logger";
import { openIndexedSearch } from "../../../../src/modules/jobs/repositories/valkeyJobSearch.adapter";
vi.mock("../../../../src/lib/cache", () => ({
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
  cacheSearchKeywords: vi.fn(),
}));
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchKeywords,
} from "../../../../src/lib/cache";
import { JobSearchRepository } from "../../../../src/modules/jobs/repositories/jobSearch.repository";
import { parseJobSearchQuery } from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";
import { professionalFamilies } from "../../../../src/modules/jobs/types/professionalTaxonomy";

const jobs = professionalFamilies.map((f) => ({
  id: f.id,
  title: "Senior Engineer",
  location: "São Paulo, Brasil",
  modality: "Remote",
  description: "CLT",
  classification: {
    primaryFamily: f.id,
    relatedFamilies:
      f.id === "leadership"
        ? ["backend", "devops", "product"]
        : f.id === "platform"
          ? ["devops"]
          : [],
    seniority: "senior",
  },
}));
const repository = new JobSearchRepository();
function seed(data: unknown[]) {
  vi.mocked(cacheAbsoluteSMembers).mockResolvedValue(
    data.map((j) => (j as { id: string }).id),
  );
  vi.mocked(cacheGetJobsByIds).mockImplementation(async (ids) =>
    ids.flatMap((id) => data.filter((j) => (j as { id: string }).id === id)),
  );
}
async function search(query: Record<string, string>, page = 1, limit = 100) {
  return repository.search(parseJobSearchQuery(query), { page, limit });
}
beforeEach(() => {
  vi.clearAllMocks();
  seed(jobs);
});
describe("persisted family search", () => {
  it("inclui a hidratação final do ranking no diagnóstico indexado", async () => {
    const data = [{ id: "a", matchScore: 90 }, { id: "b", matchScore: 80 }];
    const indexed = {
      async *batches() { yield data; },
      rank: vi.fn().mockResolvedValue(undefined),
      rankedIds: vi.fn().mockResolvedValue(["a"]),
      hydrate: vi.fn().mockResolvedValue([data[0]]),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(openIndexedSearch).mockResolvedValueOnce(indexed);
    vi.stubEnv("JOB_SEARCH_DIAGNOSTICS", "1");
    try {
      const result = await repository.search(
        parseJobSearchQuery({ matchSort: "desc" }),
        { page: 1, limit: 1 }, async (batch) => batch,
      );
      expect(result).toEqual({ total: 2, jobs: [data[0]] });
      expect(indexed.close).toHaveBeenCalledOnce();
      expect(indexed.rankedIds).toHaveBeenCalledWith(0, 1, 2);
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
        batches: 1, hydratedDocuments: 3, matchedDocuments: 2,
        returnedDocuments: 1, total: 2, indexed: true, matchSorted: true,
      }), "Diagnóstico agregado da busca de vagas");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("diagnostica a varredura além da página sem registrar documentos ou filtros", async () => {
    const data = Array.from({ length: 605 }, (_, i) => ({ id: String(i) }));
    seed(data);
    vi.stubEnv("JOB_SEARCH_DIAGNOSTICS", "1");
    try {
      const result = await search({}, 1, 50);
      expect(result.total).toBe(605);
      expect(result.jobs).toHaveLength(50);
      expect(logger.info).toHaveBeenCalledWith({
        durationMs: expect.any(Number), candidatesMs: expect.any(Number),
        hydrationMs: expect.any(Number), filterMs: expect.any(Number),
        matchMs: expect.any(Number), rankingMs: expect.any(Number),
        batches: 4, hydratedDocuments: 605, matchedDocuments: 605,
        returnedDocuments: 50, total: 605, indexed: false, matchSorted: false,
      }, "Diagnóstico agregado da busca de vagas");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([
    ["backend", "primary", ["backend"]],
    ["backend", "any", ["backend", "leadership"]],
    ["backend,fullstack", "primary", ["backend", "fullstack"]],
    ["backend,fullstack", "any", ["backend", "fullstack", "leadership"]],
    ["fullstack", "primary", ["fullstack"]],
    [
      "backend,frontend,fullstack",
      "primary",
      ["backend", "frontend", "fullstack"],
    ],
    ["devops", "primary", ["devops"]],
    ["platform", "primary", ["platform"]],
    ["devops,platform", "primary", ["devops", "platform"]],
    ["devops", "any", ["devops", "platform", "leadership"]],
    ["product", "primary", ["product"]],
    ["product_design", "primary", ["product_design"]],
    ["product,product_design", "primary", ["product", "product_design"]],
  ])("OR semantics %s / %s", async (family, familyMode, expected) => {
    const result = await search({ family, familyMode });
    expect(result.jobs.map((j) => (j as { id: string }).id)).toEqual(expected);
    expect(result.total).toBe(expected.length);
  });
  it("ANDs product families with seniority, modality, location and contract", async () => {
    expect(
      (
        await search({
          family: "product,product_design",
          familyMode: "primary",
          seniority: "senior",
          model: "remoto",
          city: "São Paulo",
          contract: "clt",
        })
      ).total,
    ).toBe(2);
    expect(
      (await search({ family: "product,product_design", contract: "pj" }))
        .total,
    ).toBe(0);
  });
  it("uses identical predicate for total and page", async () => {
    expect(await search({ family: "backend,fullstack" }, 2, 1)).toEqual({
      total: 3,
      jobs: [jobs.find((j) => j.id === "fullstack")],
    });
    expect(await search({ family: "backend,fullstack" }, 9, 1)).toEqual({
      total: 3,
      jobs: [],
    });
  });
  it("keeps reads bounded and counts beyond the page including missing documents", async () => {
    const data = Array.from({ length: 605 }, (_, i) => ({
      id: `${i}`,
      classification: { primaryFamily: i % 2 ? "backend" : "frontend" },
    }));
    seed(data);
    vi.mocked(cacheAbsoluteSMembers).mockResolvedValue([
      ...data.map((j) => j.id),
      "orphan",
    ]);
    const result = await search({ family: "backend" }, 2, 3);
    expect(result.total).toBe(302);
    expect(result.jobs.map((j) => (j as { id: string }).id)).toEqual([
      "7",
      "9",
      "11",
    ]);
    expect(
      vi
        .mocked(cacheGetJobsByIds)
        .mock.calls.every(([ids]) => ids.length <= 200),
    ).toBe(true);
  });
  it("preserves keyword resolution and ANDs it with family", async () => {
    vi.mocked(cacheSearchKeywords).mockResolvedValue(["backend", "frontend"]);
    expect(
      (await search({ keywords: "node,react", family: "backend" })).total,
    ).toBe(1);
    expect(cacheSearchKeywords).toHaveBeenCalledWith(["node", "react"]);
    expect(cacheAbsoluteSMembers).not.toHaveBeenCalled();
  });
  it.each(["asc", "desc"])(
    "sorts globally across batches (%s)",
    async (matchSort) => {
      const data = Array.from({ length: 405 }, (_, i) => ({
        id: `${i}`,
        matchScore: i,
        classification: { primaryFamily: "backend" },
      }));
      seed(data);
      const result = await repository.search(
        parseJobSearchQuery({ family: "backend", matchSort }),
        { page: 2, limit: 2 },
        async (batch) => batch,
      );
      expect(result.total).toBe(405);
      expect(result.jobs.map((j) => (j as { id: string }).id)).toEqual(
        matchSort === "desc" ? ["402", "401"] : ["2", "3"],
      );
    },
  );
});
