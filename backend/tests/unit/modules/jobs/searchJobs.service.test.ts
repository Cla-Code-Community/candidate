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
    family: [],
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

describe("SearchJobsService.execute - hasFilters", () => {
  it("usa cacheSearchJobIds e retorna verified quando há resultados indexados", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockHasStructuredFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({
        keywords: ["react"],
        family: ["front"],
        technology: ["react"],
        seniority: "sr",
        level: "senior",
        location: "BR",
        continent: "SA",
        country: "BR",
        state: "SP",
        city: "SP",
        type: ["remote"],
        contract: "clt",
      }),
    );
    mockCacheSearchJobIds.mockResolvedValueOnce(["id1", "id2"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "id1" }, { id: "id2" }]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(mockCacheSearchJobIds).toHaveBeenCalledWith({
      keywords: ["react"],
      family: ["front"],
      technology: ["react"],
      seniority: "sr",
      level: "senior",
      location: "BR",
      continent: "SA",
      country: "BR",
      state: "SP",
      city: "SP",
      type: ["remote"],
      model: ["remote"],
      contract: "clt",
    });
    expect(result.source).toContain("structured_indexes:verified");
  });

  it("cai no fallback quando cacheSearchJobIds retorna vazio", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockHasStructuredFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ keywords: ["react"] }),
    );
    mockCacheSearchJobIds.mockResolvedValueOnce([]);
    mockCacheSearchKeywords.mockResolvedValueOnce(["legacy-id"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "legacy-id" }]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result.source).toContain("legacy_post_filter_fallback");
    expect(mockCacheSearchKeywords).toHaveBeenCalledWith(["react"]);
  });
});

describe("SearchJobsService.execute - hasPostOnlyFilters", () => {
  it("aplica filterJobs e retorna post_filter", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockHasStructuredFilters.mockReturnValue(false);
    mockHasPostOnlyFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ matchSort: "desc" }),
    );
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    mockFilterJobs.mockReturnValueOnce([{ id: "a" }]);

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(mockFilterJobs).toHaveBeenCalled();
    expect(result.source).toContain("post_filter");
    expect(mockSortJobsByMatch).toHaveBeenCalled();
  });
});

describe("SearchJobsService.execute - matchSort sem hasFilters", () => {
  it("enriquece, ordena globalmente, pagina e re-enriquece a página", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ matchSort: "desc" }),
    );
    mockCacheAbsoluteSMembers.mockResolvedValueOnce(["a", "b"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "a" }, { id: "b" }]);
    mockSortJobsByMatch.mockReturnValueOnce([{ id: "b" }, { id: "a" }]);
    mockPaginate.mockReturnValueOnce({
      data: [{ id: "b" }],
      pagination: {
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      },
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(profileService.enrich).toHaveBeenCalledTimes(2);
    expect(result.source).toContain("match_sorted_desc");
    expect(result.hasNext).toBe(true);
  });
});

describe("SearchJobsService - paginateFilteredJobs com matchSort", () => {
  it("enriquece todos, ordena, pagina e re-enriquece página", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockHasStructuredFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ matchSort: "asc", keywords: ["x"] }),
    );
    mockCacheSearchJobIds.mockResolvedValueOnce(["1", "2"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "1" }, { id: "2" }]);
    mockFilterJobs.mockReturnValueOnce([{ id: "1" }, { id: "2" }]);
    mockSortJobsByMatch.mockReturnValueOnce([{ id: "1" }, { id: "2" }]);
    mockPaginate.mockReturnValueOnce({
      data: [{ id: "1" }],
      pagination: {
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      },
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(profileService.enrich).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(2);
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
  it("mapeia pagination para o resultado", async () => {
    const profileService = buildProfileMatchService();
    const svc = new SearchJobsService(profileService);

    mockHasStructuredFilters.mockReturnValue(true);
    mockParseJobSearchQuery.mockReturnValue(
      emptyFilters({ family: ["backend"] }),
    );
    mockCacheSearchJobIds.mockResolvedValueOnce(["a"]);
    mockCacheGetJobsByIds.mockResolvedValueOnce([{ id: "a" }]);
    mockPaginate.mockReturnValueOnce({
      data: [{ id: "a" }],
      pagination: {
        total: 5,
        page: 2,
        limit: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      },
    });

    const result = await svc.execute({ userId: "u1", query: {} });

    expect(result).toMatchObject({
      total: 5,
      page: 2,
      limit: 3,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
    });
  });
});
