import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
  cacheGetJobsByIdsDetailed: vi.fn(),
  cacheRemoveJobIndexIds: vi.fn(),
  cacheSearchJobIds: vi.fn(),
  cacheSearchKeywords: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
}));

vi.mock("../../../src/lib/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/lib/cache")>()),
  ...cacheMocks,
}));

vi.mock("iron-session", () => ({
  getIronSession: vi.fn().mockResolvedValue({ userId: "user-search" }),
}));

vi.mock("../../../src/modules/users/users.service", () => ({
  UsersService: class {
    getUserById = profileMocks.getUserById;
  },
}));

import { createJobsApiApp } from "../../../src/app";

const baseJobs = [
  {
    id: "joinville-go",
    title: "Desenvolvedor Go Sênior",
    company: "Acme",
    location: "Joinville, Santa Catarina - Brasil",
    description: "Vaga presencial CLT",
    classification: {
      primaryFamily: "Backend",
      technologies: ["Go", "PostgreSQL"],
      seniority: "Sênior",
    },
  },
  {
    id: "curitiba-go",
    title: "Desenvolvedor Go Sênior",
    company: "Acme",
    location: "Curitiba, Paraná - Brasil",
    description: "Vaga presencial CLT",
    classification: {
      primaryFamily: "Backend",
      technologies: ["Go", "PostgreSQL"],
      seniority: "Sênior",
    },
  },
  {
    id: "toronto-react",
    title: "Frontend Engineer",
    company: "Globex",
    location: "Toronto, Canadá",
    modality: "Hybrid",
    description: "React, full time",
    classification: {
      primaryFamily: "Frontend",
      technologies: ["React", "TypeScript"],
      seniority: "Pleno",
    },
  },
  {
    id: "new-york-react",
    title: "Frontend Engineer",
    company: "Globex",
    location: "New York, United States",
    modality: "Remote",
    description: "React, TypeScript, PJ",
    classification: {
      primaryFamily: "Frontend",
      technologies: ["React", "TypeScript"],
      seniority: "Pleno",
    },
  },
];

const app = createJobsApiApp();
const searchUrl = "/api/v1/jobs/search";

function ids(jobs: Array<{ id?: string }>) {
  return jobs.map((job) => job.id);
}

function setStructuredJobs(
  jobs: Array<{ id: string; [key: string]: unknown }> = baseJobs,
) {
  cacheMocks.cacheSearchJobIds.mockResolvedValue(jobs.map((job) => job.id));
  cacheMocks.cacheGetJobsByIds.mockResolvedValue(jobs);
}

function setLegacyJobs(
  jobs: Array<{ id: string; [key: string]: unknown }> = baseJobs,
) {
  cacheMocks.cacheAbsoluteSMembers.mockResolvedValue(jobs.map((job) => job.id));
  cacheMocks.cacheGetJobsByIds.mockResolvedValue(jobs);
}

function setFallbackJobs(jobs = baseJobs) {
  cacheMocks.cacheSearchJobIds.mockResolvedValue([]);
  cacheMocks.cacheAbsoluteSMembers.mockResolvedValue(jobs.map((job) => job.id));
  cacheMocks.cacheGetJobsByIds.mockResolvedValue(jobs);
}

beforeEach(() => {
  vi.clearAllMocks();
  profileMocks.getUserById.mockResolvedValue(undefined);
  cacheMocks.cacheSearchJobIds.mockResolvedValue([]);
  cacheMocks.cacheSearchKeywords.mockResolvedValue([]);
  cacheMocks.cacheAbsoluteSMembers.mockResolvedValue([]);
  cacheMocks.cacheGetJobsByIds.mockResolvedValue([]);
  cacheMocks.cacheGetJobsByIdsDetailed.mockImplementation(
    async (jobIds: string[]) => ({
      jobs: baseJobs.filter((job) => jobIds.includes(job.id)),
      missingIds: [],
    }),
  );
});

describe("Integration - GET /jobs/search", () => {
  it("atravessa rota, parser, filtro e service sem filtros", async () => {
    cacheMocks.cacheAbsoluteSMembers.mockResolvedValue(baseJobs.map((job) => job.id));

    const response = await request(app).get(searchUrl).expect(200);

    expect(ids(response.body.jobs)).toEqual(ids(baseJobs));
    expect(response.body).toMatchObject({
      total: baseJobs.length,
      page: 1,
      limit: 100,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
      source: "valkey_global_index",
    });
  });

  it("usa keywords no filtro legacy da busca", async () => {
    cacheMocks.cacheSearchKeywords.mockResolvedValue(["joinville-go"]);
    cacheMocks.cacheGetJobsByIds.mockResolvedValue([baseJobs[0]]);

    const response = await request(app)
      .get(searchUrl)
      .query({ keywords: "go,backend" })
      .expect(200);

    expect(ids(response.body.jobs)).toEqual(["joinville-go"]);
    expect(cacheMocks.cacheSearchKeywords).toHaveBeenCalledWith([
      "go",
      "backend",
    ]);
  });

  it("retorna erro HTTP quando a busca de índices falha", async () => {
    cacheMocks.cacheSearchJobIds.mockRejectedValueOnce(new Error("cache down"));

    const response = await request(app)
      .get(searchUrl)
      .query({ family: "Backend" })
      .expect(500);

    expect(response.body).toMatchObject({
      message: "Erro ao recuperar vagas em memória.",
      error: "cache down",
    });
  });

  it("combina filtros estruturados e pós-filtra as candidatas do cache", async () => {
    setStructuredJobs();

    const response = await request(app)
      .get(searchUrl)
      .query({ technology: "Go", family: "Backend", country: "Brasil", state: "SC", city: "Joinville", contract: "clt" })
      .expect(200);

    expect(ids(response.body.jobs)).toEqual(["joinville-go"]);
    expect(response.body.total).toBe(1);
    expect(response.body.source).toContain("structured_indexes:verified");
  });

  it.each([
    { query: { model: "remoto" }, expected: "new-york-react" },
    { query: { type: "hibrido" }, expected: "toronto-react" },
    { query: { model: "remoto", type: "remoto" }, expected: "new-york-react" },
    { query: { model: "remoto", type: "hibrido" }, expected: "new-york-react" },
  ])("aplica modalidade pelo parâmetro efetivo $query", async ({ query, expected }) => {
    setStructuredJobs();

    const response = await request(app).get(searchUrl).query(query).expect(200);

    expect(ids(response.body.jobs)).toEqual([expected]);
  });

  it("usa cache estruturado preenchido e valida a resposta final", async () => {
    setStructuredJobs();

    const response = await request(app)
      .get(searchUrl)
      .query({ family: "Backend" })
      .expect(200);

    expect(ids(response.body.jobs)).toEqual(["joinville-go", "curitiba-go"]);
    expect(cacheMocks.cacheSearchJobIds).toHaveBeenCalledOnce();
    expect(response.body.source).toContain("structured_indexes:verified");
  });

  it("respeita o limite máximo de 100 resultados por página", async () => {
    const jobs = Array.from({ length: 105 }, (_, index) => ({
      id: `job-${index}`,
      title: `Engineer ${index}`,
      location: "Remote",
      classification: { primaryFamily: "Backend" },
    }));
    setStructuredJobs(jobs);

    const response = await request(app)
      .get(searchUrl)
      .query({ family: "Backend", page: "1", limit: "101" })
      .expect(200);

    expect(response.body.jobs).toHaveLength(100);
    expect(response.body).toMatchObject({
      total: 105,
      page: 1,
      limit: 100,
      totalPages: 2,
      hasNext: true,
    });
  });

  it.each([
    { query: { continent: "America do Sul" }, expected: ["joinville-go", "curitiba-go"] },
    { query: { state: "SC" }, expected: ["joinville-go"] },
    { query: { city: "Joinville" }, expected: ["joinville-go"] },
    {
      query: { continent: "America do Sul", state: "SC", city: "Joinville" },
      expected: ["joinville-go"],
    },
  ])("preserva filtros de localização no fallback: $query", async ({ query, expected }) => {
    setFallbackJobs();

    const response = await request(app).get(searchUrl).query(query).expect(200);

    expect(ids(response.body.jobs)).toEqual(expected);
    expect(response.body.source).toContain("legacy_post_filter_fallback");
  });

  it("preserva paginação depois de filtrar no fallback", async () => {
    setFallbackJobs();

    const response = await request(app)
      .get(searchUrl)
      .query({ continent: "America do Sul", limit: "1", page: "2" })
      .expect(200);

    expect(ids(response.body.jobs)).toEqual(["curitiba-go"]);
    expect(response.body).toMatchObject({
      total: 2,
      page: 2,
      limit: 1,
      totalPages: 2,
      hasNext: false,
      hasPrev: true,
    });
  });

  it.each([
    { query: { page: "1", limit: "2" }, expected: ["joinville-go", "curitiba-go"], totalPages: 2 },
    {
      query: { page: "0", limit: "0" },
      expected: ["joinville-go", "curitiba-go", "toronto-react", "new-york-react"],
      totalPages: 1,
    },
    { query: { page: "2", limit: "2" }, expected: ["toronto-react", "new-york-react"], totalPages: 2 },
    { query: { page: "9", limit: "2" }, expected: [], totalPages: 2 },
  ])("aplica limites e offsets na paginação $query", async ({ query, expected, totalPages }) => {
    cacheMocks.cacheAbsoluteSMembers.mockResolvedValue(baseJobs.map((job) => job.id));

    const response = await request(app).get(searchUrl).query(query).expect(200);

    expect(ids(response.body.jobs)).toEqual(expected);
    expect(response.body.totalPages).toBe(totalPages);
  });

  it("calcula match real sem correspondência, parcial e completo e ordena pelo score", async () => {
    const matchJobs = [
      { id: "no-match", title: "Product Manager", company: "Match", location: "Remote" },
      { id: "partial", title: "Backend Go", company: "Match", location: "Remote" },
      { id: "complete", title: "Backend Go and React", company: "Match", location: "Remote" },
    ];
    setLegacyJobs(matchJobs);
    profileMocks.getUserById.mockResolvedValue({
      technologies: null,
      technologyExperiences: [
        { name: "Go", years: 2 },
        { name: "React", years: 1 },
      ],
    });

    const response = await request(app)
      .get(searchUrl)
      .query({ company: "Match", matchSort: "desc" })
      .expect(200);

    expect(ids(response.body.jobs)).toEqual(["complete", "partial", "no-match"]);
    expect(response.body.jobs).toMatchObject([
      { matchScore: 98, matchedTechnologies: ["Go", "React"] },
      { matchScore: 82, matchedTechnologies: ["Go"] },
      { matchScore: 45, matchedTechnologies: [] },
    ]);
  });

  it("não adiciona score quando não há dados de perfil", async () => {
    setLegacyJobs([{ id: "job-no-profile", title: "Backend Go", company: "Acme" }]);

    const response = await request(app)
      .get(searchUrl)
      .query({ company: "Acme" })
      .expect(200);

    expect(response.body.jobs[0]).not.toHaveProperty("matchScore");
    expect(profileMocks.getUserById).toHaveBeenCalledWith("user-search");
  });
});
