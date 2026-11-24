import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ apply: vi.fn() }));
vi.mock("../../../../src/modules/jobs/filters/jobSearch.filter", async (original) => {
  const filters = await original<typeof import("../../../../src/modules/jobs/filters/jobSearch.filter")>();
  return {
    ...filters,
    prepareJobFilter: vi.fn((query) => {
      const apply = filters.prepareJobFilter(query);
      return (jobs: unknown[]) => { calls.apply(jobs); return apply(jobs); };
    }),
  };
});
vi.mock("../../../../src/modules/jobs/repositories/valkeyJobSearch.adapter", () => ({
  openIndexedSearch: vi.fn(async () => null),
}));
vi.mock("../../../../src/modules/jobs/cache/valkeySearchCache.adapter", () => ({
  searchPageCache: { search: (_filters: unknown, _page: unknown, _context: unknown, query: () => Promise<unknown>) => query() },
}));
vi.mock("../../../../src/lib/cache", () => ({
  cacheAbsoluteSMembers: vi.fn(), cacheGetJobsByIds: vi.fn(), cacheSearchKeywords: vi.fn(),
}));
import { cacheAbsoluteSMembers, cacheGetJobsByIds } from "../../../../src/lib/cache";
import { filterJobs, prepareJobFilter, sortJobsByMatch } from "../../../../src/modules/jobs/filters/jobSearch.filter";
import { parseJobSearchQuery } from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";
import { JobSearchRepository } from "../../../../src/modules/jobs/repositories/jobSearch.repository";

beforeEach(() => vi.clearAllMocks());

describe("preparação única dos filtros na busca fria", () => {
  it.each([null, "asc", "desc"] as const)("preserva filtros residuais, total e página com Match %s", async (direction) => {
    const data = Array.from({ length: 405 }, (_, index) => ({
      id: String(index), company: index % 3 === 0 ? "Acme" : "Outra",
      modality: index % 2 === 0 ? "Remote" : "Onsite", matchScore: index % 7,
      classification: { primaryFamily: "backend", technologies: ["Go"] },
    }));
    vi.mocked(cacheAbsoluteSMembers).mockResolvedValue(data.map(job => job.id));
    vi.mocked(cacheGetJobsByIds).mockImplementation(async ids => ids.flatMap(id => data.filter(job => job.id === id)));
    const query = parseJobSearchQuery({ company: "Acme", type: "remoto", family: "backend", technology: "Go", ...(direction ? { matchSort: direction } : {}) });
    const matching = filterJobs(data, query);
    const expected = direction ? sortJobsByMatch(matching, direction) : matching;
    const page = await new JobSearchRepository().search(query, { page: 2, limit: 4 }, direction ? async jobs => jobs : undefined);
    expect(page).toEqual({ jobs: expected.slice(4, 8), total: expected.length });
    expect(prepareJobFilter).toHaveBeenCalledExactlyOnceWith(query);
    expect(calls.apply.mock.calls.map(([batch]) => batch.length)).toEqual([200, 200, 5]);
  });
});
