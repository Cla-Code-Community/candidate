import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
  cacheGetJobsByIdsDetailed: vi.fn(),
  cacheRemoveJobIndexIds: vi.fn(),
  cacheSearchJobIds: vi.fn(),
  cacheSearchKeywords: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../../src/lib/cache.js", () => ({
  cacheAbsoluteSMembers: mocks.cacheAbsoluteSMembers,
  cacheGetJobsByIds: mocks.cacheGetJobsByIds,
  cacheGetJobsByIdsDetailed: mocks.cacheGetJobsByIdsDetailed,
  cacheRemoveJobIndexIds: mocks.cacheRemoveJobIndexIds,
  cacheSearchJobIds: mocks.cacheSearchJobIds,
  cacheSearchKeywords: mocks.cacheSearchKeywords,
}));

vi.mock("../../../../src/logger.js", () => ({
  logWarn: mocks.logWarn,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const profileMocks = vi.hoisted(() => ({
  technologies: [] as Array<{ name: string; years: number }>,
}));

vi.mock(
  "../../../../src/modules/jobs/services/jobProfileMatch.service.js",
  async () => {
    const { scoreJobWithTechnologies } = await import(
      "../../../../src/modules/jobs/services/jobMatch.service.js"
    );

    return {
      JobProfileMatchService: class {
        async getUserTechnologies() {
          return profileMocks.technologies;
        }
        async enrich(_userId: unknown, jobs: any[], technologies: any[]) {
          if (!technologies || technologies.length === 0) return jobs;
          return jobs.map((job) =>
            scoreJobWithTechnologies(job, technologies),
          );
        }
      },
    };
  },
);

import { SearchJobsService } from "../../../../src/modules/jobs/services/searchJobs.service.js";

const INDEX_KEY = "scraper:jobs:index";

function makeIds(count: number, prefix = "id"): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function job(id: string) {
  return { id, title: `Vaga ${id}`, company: "ACME" };
}

function hydrateFrom(liveIds: Set<string>) {
  return async (ids: string[]) => ({
    jobs: ids.filter((id) => liveIds.has(id)).map(job),
    missingIds: ids.filter((id) => !liveIds.has(id)),
  });
}

describe("SearchJobsService — índice global do Valkey", () => {
  let service: SearchJobsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheRemoveJobIndexIds.mockResolvedValue(0);
    mocks.cacheSearchJobIds.mockResolvedValue([]);
    mocks.cacheSearchKeywords.mockResolvedValue([]);
    profileMocks.technologies = [];
    service = new SearchJobsService();
  });

  it("retorna a primeira página preenchida quando todos os IDs têm documento", async () => {
    const ids = makeIds(120);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set(ids)),
    );

    const result = await service.execute({ query: { page: "1", limit: "50" } });

    expect(mocks.cacheAbsoluteSMembers).toHaveBeenCalledWith(INDEX_KEY);
    expect(result.source).toBe("valkey_global_index");
    expect(result.total).toBe(120);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
    expect(result.jobs).toHaveLength(50);
    expect(result.jobs[0]).toEqual(job("id-1"));
    expect(mocks.cacheRemoveJobIndexIds).not.toHaveBeenCalled();
  });

  it("preenche a página avançando no índice quando a primeira fatia só tem IDs órfãos", async () => {
    const ids = makeIds(200);
    // Os 50 primeiros IDs do índice estão órfãos (documentos expirados).
    const liveIds = new Set(ids.slice(50));
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(hydrateFrom(liveIds));

    const result = await service.execute({ query: { page: "1", limit: "50" } });

    expect(result.jobs).toHaveLength(50);
    expect(result.jobs[0]).toEqual(job("id-51"));
    // total desconta os órfãos já identificados, em vez de anunciar 200.
    expect(result.total).toBe(150);
    expect(result.totalPages).toBe(3);
    expect(result.hasNext).toBe(true);
  });

  it("remove do índice global os IDs sem documento (auto-reparo)", async () => {
    const ids = makeIds(100);
    const orphans = ["id-1", "id-2", "id-3"];
    const liveIds = new Set(ids.filter((id) => !orphans.includes(id)));
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(hydrateFrom(liveIds));

    const result = await service.execute({ query: { page: "1", limit: "50" } });

    expect(mocks.cacheRemoveJobIndexIds).toHaveBeenCalledWith(orphans);
    expect(result.jobs).toHaveLength(50);
    expect(result.total).toBe(97);
  });

  it("não falha a requisição quando o auto-reparo do índice falha", async () => {
    const ids = makeIds(60);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set(ids.slice(1))),
    );
    mocks.cacheRemoveJobIndexIds.mockRejectedValue(new Error("valkey down"));

    const result = await service.execute({ query: { page: "1", limit: "50" } });

    expect(result.jobs).toHaveLength(50);
    expect(mocks.logWarn).toHaveBeenCalled();
  });

  it("retorna página vazia e coerente quando todos os IDs do índice estão órfãos", async () => {
    const ids = makeIds(200);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set<string>()),
    );

    const result = await service.execute({ query: { page: "1", limit: "50" } });

    expect(result.jobs).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.hasNext).toBe(false);
  });

  it("limita o esforço de hidratação por requisição (não varre o índice inteiro)", async () => {
    const ids = makeIds(100_000);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set<string>()),
    );

    await service.execute({ query: { page: "1", limit: "50" } });

    expect(mocks.cacheGetJobsByIdsDetailed).toHaveBeenCalledTimes(10);
  });

  it("pagina corretamente a última página parcial", async () => {
    const ids = makeIds(120);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set(ids)),
    );

    const result = await service.execute({ query: { page: "3", limit: "50" } });

    expect(result.jobs).toHaveLength(20);
    expect(result.jobs[0]).toEqual(job("id-101"));
    expect(result.page).toBe(3);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it("retorna jobs vazio quando a página solicitada está além do índice", async () => {
    const ids = makeIds(10);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set(ids)),
    );

    const result = await service.execute({ query: { page: "9", limit: "50" } });

    expect(result.jobs).toEqual([]);
    expect(result.total).toBe(10);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it("mantém o caminho de filtros estruturados usando os índices do Valkey", async () => {
    mocks.cacheSearchJobIds.mockResolvedValue(["id-1", "id-2"]);
    mocks.cacheGetJobsByIds.mockResolvedValue([
      { id: "id-1", title: "Dev Node", company: "ACME", location: "Brasil" },
      { id: "id-2", title: "Dev Node", company: "Globo", location: "Brasil" },
    ]);

    const result = await service.execute({ query: { country: "Brasil" } });

    expect(mocks.cacheAbsoluteSMembers).not.toHaveBeenCalled();
    expect(result.source).toContain("structured_indexes");
    expect(result.jobs).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("filtra por empresa mesmo sem índice dedicado, mantendo total coerente", async () => {
    const ids = ["id-1", "id-2", "id-3"];
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIds.mockResolvedValue([
      { id: "id-1", title: "Dev Node", company: "ACME Tecnologia" },
      { id: "id-2", title: "Dev Node", company: "Globo" },
      { id: "id-3", title: "Dev Go", company: "acme labs" },
    ]);

    const result = await service.execute({ query: { company: "acme" } });

    expect(result.jobs).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(1);
    expect(result.source).toContain("post_filter");
  });

  it("prioriza vagas compatíveis com as tecnologias do perfil do candidato", async () => {
    profileMocks.technologies = [{ name: "Go", years: 4 }];
    const ids = ["sem-relacao-1", "sem-relacao-2", "compativel-1"];
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    // Índice invertido do scraper devolve a vaga compatível com o perfil.
    mocks.cacheSearchKeywords.mockResolvedValue(["compativel-1"]);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(async (pageIds: string[]) => ({
      jobs: pageIds.map((id) => ({
        id,
        title: id === "compativel-1" ? "Desenvolvedor Go" : "Analista Contábil",
        company: "ACME",
      })),
      missingIds: [],
    }));

    const result = await service.execute({
      query: { page: "1", limit: "50" },
      userId: "user-1",
    });

    expect(mocks.cacheSearchKeywords).toHaveBeenCalledWith(["Go"]);
    expect((result.jobs[0] as { id: string }).id).toBe("compativel-1");
    expect(result.source).toContain("profile_ranked");
    expect(result.total).toBe(3);
  });

  it("mantém a ordem do índice quando o perfil não tem tecnologias", async () => {
    const ids = ["id-1", "id-2"];
    mocks.cacheAbsoluteSMembers.mockResolvedValue(ids);
    mocks.cacheGetJobsByIdsDetailed.mockImplementation(
      hydrateFrom(new Set(ids)),
    );

    const result = await service.execute({ query: {}, userId: "user-1" });

    expect(mocks.cacheSearchKeywords).not.toHaveBeenCalled();
    expect(result.source).toBe("valkey_global_index");
    expect((result.jobs[0] as { id: string }).id).toBe("id-1");
  });
});
