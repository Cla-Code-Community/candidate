import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/lib/cache", () => ({
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
  cacheGetJobsByIdsDetailed: vi.fn(),
  cacheRemoveJobIndexIds: vi.fn(),
  cacheSearchJobIds: vi.fn(),
  cacheSearchKeywords: vi.fn(),
}));

vi.mock("../../../../src/lib/pagination", () => ({
  paginate: vi.fn(),
  parsePagination: vi.fn(),
}));

vi.mock("../../../../src/logger", () => ({
  logWarn: vi.fn(),
}));

vi.mock("../../../../src/modules/jobs/filters/jobSearch.filter", () => ({
  filterJobs: vi.fn(),
  sortJobsByMatch: vi.fn(),
}));

vi.mock("../../../../src/modules/jobs/parsers/jobSearchQuery.parser", () => ({
  hasPostOnlyFilters: vi.fn(),
  hasStructuredFilters: vi.fn(),
  parseJobSearchQuery: vi.fn(),
}));

import {
    cacheAbsoluteSMembers,
    cacheGetJobsByIds,
    cacheGetJobsByIdsDetailed,
    cacheRemoveJobIndexIds,
    cacheSearchJobIds,
    cacheSearchKeywords,
} from "../../../../src/lib/cache";
import { paginate, parsePagination } from "../../../../src/lib/pagination";
import { logWarn } from "../../../../src/logger";
import {
    filterJobs,
    sortJobsByMatch,
} from "../../../../src/modules/jobs/filters/jobSearch.filter";
import {
    hasPostOnlyFilters,
    hasStructuredFilters,
    parseJobSearchQuery,
} from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";
import { JobProfileMatchService } from "../../../../src/modules/jobs/services/jobProfileMatch.service";
import {
    SearchJobsService,
    searchJobsService,
} from "../../../../src/modules/jobs/services/searchJobs.service";
import type { ParsedJobSearchQuery } from "../../../../src/modules/jobs/types/jobSearch.types";

const mockCacheAbsoluteSMembers = vi.mocked(cacheAbsoluteSMembers);
const mockCacheGetJobsByIds = vi.mocked(cacheGetJobsByIds);
const mockCacheGetJobsByIdsDetailed = vi.mocked(cacheGetJobsByIdsDetailed);
const mockCacheRemoveJobIndexIds = vi.mocked(cacheRemoveJobIndexIds);
const mockCacheSearchJobIds = vi.mocked(cacheSearchJobIds);
const mockCacheSearchKeywords = vi.mocked(cacheSearchKeywords);
const mockPaginate = vi.mocked(paginate);
const mockParsePagination = vi.mocked(parsePagination);
const mockLogWarn = vi.mocked(logWarn);
const mockFilterJobs = vi.mocked(filterJobs);
const mockSortJobsByMatch = vi.mocked(sortJobsByMatch);
const mockHasPostOnlyFilters = vi.mocked(hasPostOnlyFilters);
const mockHasStructuredFilters = vi.mocked(hasStructuredFilters);
const mockParseJobSearchQuery = vi.mocked(parseJobSearchQuery);

const defaultPagination = { page: 1, limit: 10 };

function emptyFilters(
  overrides: Partial<ParsedJobSearchQuery> = {},
): ParsedJobSearchQuery {
  return {
    keywords: [],
    families: [],
    familyMode: "any",
    technology: [],
    company: [],
    seniority: "",
    level: "",
    location: "",
    continent: "",
    country: "",
    state: "",
    city: "",
    type: [],
    contract: "",
    matchSort: null,
    ...overrides,
  };
}

function makeEnrichResult(jobs: unknown[]) {
  return jobs.map((job) => ({ ...(job as object), matchScore: 50 }));
}

function buildProfileMatchService() {
  const service = {
    getUserTechnologies: vi.fn().mockResolvedValue([]),
    enrich: vi
      .fn()
      .mockImplementation(async (_u, jobs: unknown[]) =>
        makeEnrichResult(jobs),
      ),
  };
  return service as unknown as JobProfileMatchService & typeof service;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParsePagination.mockReturnValue(defaultPagination);
  mockHasStructuredFilters.mockReturnValue(false);
  mockHasPostOnlyFilters.mockReturnValue(false);
  mockParseJobSearchQuery.mockReturnValue(emptyFilters());
  mockFilterJobs.mockImplementation((jobs: unknown[]) => jobs);
  mockSortJobsByMatch.mockImplementation((jobs: unknown[]) => jobs);
  mockPaginate.mockImplementation((jobs: unknown[]) => ({
    data: jobs,
    pagination: {
      total: jobs.length,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  }));
});

describe("SearchJobsService.execute - sem filtros, sem post-only, sem matchSort", () => {
  it("resolve via índice global, ordena por perfil e retorna profile_ranked", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b", "c"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }, { id: "b" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockResolvedValueOnce(["a"]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheAbsoluteSMembers).toHaveBeenCalledWith(
      "scraper:jobs:index",
    );
    expect(mockCacheSearchKeywords).toHaveBeenCalledWith(["react"]);
    expect(result.source).toBe("valkey_global_index:profile_ranked");
    expect(mockSortJobsByMatch).toHaveBeenCalled();
  });

  it("resolve via keywords e mantém source do legacy quando sem match", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ keywords: ["react"] }),
    );
    mockCacheSearchKeywords.mockImplementation(async (keywords: string[]) => {
      if (keywords[0] === "react") return ["x"];
      return [];
    });
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "x" }],
      missingIds: [],
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheSearchKeywords).toHaveBeenNthCalledWith(1, ["react"]);
    expect(result.source).toBe("valkey_filtered_by_keywords:react");
  });

  it("retorna source simples quando matchedIds = 0", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockResolvedValueOnce([]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_global_index");
    expect(mockSortJobsByMatch).not.toHaveBeenCalled();
  });
});

describe("SearchJobsService.execute - legacyResolveIds com keywords", () => {
  it("usa cacheSearchKeywords quando keywords presentes", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ keywords: ["node", "js"] }),
    );
    mockCacheSearchKeywords.mockResolvedValueOnce(["k1", "k2"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "k1" }, { id: "k2" }],
      missingIds: [],
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_filtered_by_keywords:node+js");
  });
});

describe("SearchJobsService - repository boundary", () => {
  it.each(["primary", "any"] as const)("passes normalized %s filters and pagination without reinterpretation", async familyMode => {
    const profileService = buildProfileMatchService();
    const filters = emptyFilters({ families: ["backend", "fullstack"], familyMode });
    mockParseJobSearchQuery.mockReturnValue(filters);
    mockHasStructuredFilters.mockReturnValue(true);
    const repository = { search: vi.fn().mockResolvedValue({ jobs: [{ id: "a" }], total: 21 }) };
    const svc = new SearchJobsService(profileService, repository);
    const result = await svc.execute({ userId: "u1", query: {} });
    expect(repository.search).toHaveBeenCalledWith(filters, defaultPagination, undefined);
    expect(result).toMatchObject({ total: 21, page: 1, limit: 10, totalPages: 3, hasNext: true });
    expect(mockCacheSearchJobIds).not.toHaveBeenCalled();
  });
  it("scores batches without notifications and enriches only the final page normally", async () => {
    const profileService = buildProfileMatchService();
    mockParseJobSearchQuery.mockReturnValue(emptyFilters({ matchSort: "asc" }));
    const repository = { search: vi.fn().mockImplementation(async (_f, _p, enrich) => {
      await enrich([{ id: "candidate" }]);
      return { jobs: [{ id: "page" }], total: 20 };
    }) };
    const result = await new SearchJobsService(profileService, repository).execute({ query: {}, userId: "u1" });
    expect(profileService.enrich).toHaveBeenNthCalledWith(1, "u1", [{ id: "candidate" }], [], { notifyHighMatches: false });
    expect(profileService.enrich).toHaveBeenNthCalledWith(2, "u1", [{ id: "page" }], []);
    expect(result.total).toBe(20);
  });
});

describe("hydrateIndexPage - comportamento", () => {
  it("remove órfãos e calcula meta corretamente", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(emptyFilters());
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b", "c", "d"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }, { id: "b" }],
      missingIds: ["c"],
    });

    await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheRemoveJobIndexIds).toHaveBeenCalledWith(["c"]);
  });

  it("abre múltiplas janelas de hidratação quando faltam jobs", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(emptyFilters());
    mockParsePagination.mockReturnValue({ page: 1, limit: 1 });
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIdsDetailed
      .mockResolvedValueOnce({ jobs: [], missingIds: ["a"] })
      .mockResolvedValueOnce({
        jobs: [{ id: "b" }],
        missingIds: [],
      });

    await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheGetJobsByIdsDetailed).toHaveBeenCalledTimes(2);
  });

  it("não remove órfãos quando não há missingIds", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(emptyFilters());
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: [],
    });

    await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheRemoveJobIndexIds).not.toHaveBeenCalled();
  });

  it("logWarn quando cacheRemoveJobIndexIds falha", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(emptyFilters());
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: ["b"],
    });
    mockCacheRemoveJobIndexIds.mockRejectedValueOnce(new Error("boom"));

    await svc.execute({ userId: "u1", query: {} });

    expect(mockLogWarn).toHaveBeenCalled();
  });

  it("para ao atingir MAX_HYDRATION_WINDOWS mesmo faltando jobs", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    const ids = Array.from({ length: 20 }, (_, i) => `id${i}`);
    mockParseJobSearchQuery.mockReturnValue(emptyFilters());
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(ids);
    mockCacheGetJobsByIdsDetailed.mockResolvedValue({
      jobs: [],
      missingIds: [],
    });
    mockParsePagination.mockReturnValue({ page: 1, limit: 1 });

    await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheGetJobsByIdsDetailed).toHaveBeenCalledTimes(10);
  });
});

describe("orderIdsByProfileRelevance", () => {
  it("retorna ids originais quando não há tecnologias", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi.fn().mockResolvedValue([]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }, { id: "b" }],
      missingIds: [],
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).not.toContain("profile_ranked");
  });

  it("ignora tecnologias sem nome", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "  " }, { name: undefined }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: [],
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).not.toContain("profile_ranked");
  });

  it("logWarn e retorna ids originais quando cacheSearchKeywords falha", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockRejectedValueOnce(new Error("cache down"));

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(mockLogWarn).toHaveBeenCalled();
    expect(result.source).toBe("valkey_global_index");
  });

  it("retorna ids originais quando profileIds vazio", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockResolvedValueOnce([]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_global_index");
  });

  it("retorna ids originais quando nenhum id bate com o perfil", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "a" }, { id: "b" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockResolvedValueOnce(["zzz"]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_global_index");
  });

  it("prioriza ids relevantes e usa profile_ranked", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b", "c"]);
    mockCacheGetJobsByIdsDetailed.mockResolvedValueOnce({
      jobs: [{ id: "c" }, { id: "a" }, { id: "b" }],
      missingIds: [],
    });
    mockCacheSearchKeywords.mockResolvedValueOnce(["c"]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_global_index:profile_ranked");
    expect(mockSortJobsByMatch).toHaveBeenCalled();
  });

  it("retorna matchedIds=0 quando ids está vazio", async () => {
    const profileService = buildProfileMatchService();
    profileService.getUserTechnologies = vi
      .fn()
      .mockResolvedValue([{ name: "react" }]);
    const svc = new SearchJobsService(profileService);

    mockCacheAbsoluteSMembers.mockResolvedValueOnce([]);
    mockParsePagination.mockReturnValue({ page: 1, limit: 10 });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toBe("valkey_global_index");
    expect(mockCacheSearchKeywords).not.toHaveBeenCalled();
  });
});

describe("searchJobsService (singleton)", () => {
  it("é uma instância de SearchJobsService", () => {
    expect(searchJobsService).toBeInstanceOf(SearchJobsService);
  });
});

describe("toSearchResult - shape", () => {
  it("mapeia paginação calculada sobre os resultados filtrados", async () => {
    const profileService = buildProfileMatchService();
    const repository = { search: vi.fn().mockResolvedValue({ jobs: [{ id: "a" }], total: 5 }) };
    mockParsePagination.mockReturnValue({ page: 2, limit: 3 });
    mockHasStructuredFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(emptyFilters({ families: ["backend"] }));
    const result = await new SearchJobsService(profileService, repository).execute({ userId: "u1", query: {} });
    expect(result).toMatchObject({ total: 5, page: 2, limit: 3, totalPages: 2, hasNext: false, hasPrev: true });
  });
});
