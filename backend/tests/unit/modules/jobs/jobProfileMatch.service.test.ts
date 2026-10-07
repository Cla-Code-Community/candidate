import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getPreferences: vi.fn(),
  createHighMatchIfMissing: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../../src/modules/users/users.service", () => ({
  UsersService: class {
    getUserById = profileMocks.getUserById;
    getPreferences = profileMocks.getPreferences;
  },
}));

vi.mock("../../../../src/modules/notifications/notifications.service", () => ({
  NotificationsService: class {
    createHighMatchIfMissing = profileMocks.createHighMatchIfMissing;
  },
}));

vi.mock("../../../../src/logger", () => ({
  logWarn: profileMocks.logWarn,
}));

import { JobProfileMatchService } from "../../../../src/modules/jobs/services/jobProfileMatch.service";

describe("JobProfileMatchService", () => {
  let service: JobProfileMatchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JobProfileMatchService();
    profileMocks.getUserById.mockResolvedValue({
      technologies: null,
      technologyExperiences: [{ name: "Go", years: 2 }],
    });
    profileMocks.createHighMatchIfMissing.mockResolvedValue(undefined);
    profileMocks.getPreferences.mockResolvedValue(undefined);
  });

  it("retorna perfil vazio sem consultar usuário quando não há userId", async () => {
    await expect(service.getUserTechnologies()).resolves.toEqual([]);
    expect(profileMocks.getUserById).not.toHaveBeenCalled();
  });

  it("carrega tecnologias do perfil e captura falha de leitura", async () => {
    await expect(service.getUserTechnologies("user-1")).resolves.toEqual([
      { name: "Go", years: 2 },
    ]);
    expect(profileMocks.getUserById).toHaveBeenCalledWith("user-1");

    profileMocks.getUserById.mockRejectedValueOnce(new Error("database down"));
    await expect(service.getUserTechnologies("user-1")).resolves.toEqual([]);
    expect(profileMocks.logWarn).toHaveBeenCalledWith(
      "Não foi possível carregar perfil para cálculo de match",
      expect.objectContaining({ code: "PROFILE_READ_FAILED" }),
    );
  });

  it("preserva vagas sem score se tecnologias não existem", async () => {
    const jobs = [{ id: "job-1", title: "Backend Developer" }];

    await expect(service.enrich("user-1", jobs, [])).resolves.toBe(jobs);
    expect(profileMocks.createHighMatchIfMissing).not.toHaveBeenCalled();
  });

  it("calcula score real e cria notificação para match alto", async () => {
    const [job] = await service.enrich(
      "user-1",
      [{ id: "job-1", title: "Go Backend Developer" }],
      [{ name: "Go", years: 2 }],
    );

    expect(job).toMatchObject({
      matchScore: 94,
      matchSource: "backend_profile",
      matchedTechnologies: ["Go"],
    });
    expect(profileMocks.createHighMatchIfMissing).toHaveBeenCalledWith(
      "user-1",
      job,
    );
  });

  it("suprime notificações quando caller pede apenas cálculo de score", async () => {
    await service.enrich(
      "user-1",
      [{ id: "job-1", title: "Go Backend Developer" }],
      [{ name: "Go", years: 2 }],
      { notifyHighMatches: false },
    );

    expect(profileMocks.createHighMatchIfMissing).not.toHaveBeenCalled();
  });

  it("registra e absorve falha ao persistir notificação de match alto", async () => {
    profileMocks.createHighMatchIfMissing.mockRejectedValueOnce(
      new Error("notification store down"),
    );

    await service.enrich(
      "user-1",
      [{ id: "job-1", title: "Go Backend Developer" }],
      [{ name: "Go", years: 2 }],
    );

    expect(profileMocks.logWarn).toHaveBeenCalledWith(
      "Não foi possível registrar notificação de alto match",
      expect.objectContaining({
        code: "MATCH_NOTIFICATION_FAILED",
      }),
    );
  });
});

it("loads Product preferences once and scores without programming languages", async () => {
  vi.clearAllMocks();
  profileMocks.getUserById.mockResolvedValueOnce({
    level: "Sênior",
    technologies: [],
    technologyExperiences: [],
  });
  profileMocks.getPreferences.mockResolvedValueOnce({
    keywords: ["product", "Jira", "roadmap"],
    remoteOnly: true,
    jobTypes: ["Remoto"],
    searchLocation: "Brasil",
  });
  const service = new JobProfileMatchService();
  const capture = vi.fn();
  const technologies = await service.getUserTechnologies("candidate", capture);
  expect(technologies).toEqual([]);
  expect(capture).toHaveBeenCalledWith(
    expect.objectContaining({
      seniority: "Sênior",
      modality: "remoto",
      location: "Brasil",
    }),
  );
  const [job] = await service.enrich(
    "candidate",
    [
      {
        id: "p",
        title: "Product Manager",
        description: "Jira roadmap",
        modality: "remoto",
        location: "Brasil",
        classification: { primaryFamily: "product", seniority: "senior" },
      },
    ],
    technologies,
    { preferences: capture.mock.calls[0][0], notifyHighMatches: false },
  );
  expect(job.matchScore).toBeGreaterThan(80);
  expect(profileMocks.getPreferences).toHaveBeenCalledTimes(1);
  expect(profileMocks.createHighMatchIfMissing).not.toHaveBeenCalled();
});

describe("UserPreferences semantic mapping", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    profileMocks.getUserById.mockResolvedValue({
      level: null,
      technologies: [],
      technologyExperiences: [],
    });
  });

  it.each(["product", "product_design"])(
    "does not infer family from free keywords (%s)",
    async (family) => {
      profileMocks.getPreferences.mockResolvedValue({
        keywords: [family, "Jira", "Figma"],
        remoteOnly: false,
        jobTypes: [],
        searchLocation: null,
      });
      const capture = vi.fn();
      const service = new JobProfileMatchService();
      await service.getUserTechnologies("candidate", capture);
      const preferences = capture.mock.calls[0][0];
      expect(preferences.family).toBeUndefined();
      expect(
        preferences.skills.map((skill: { name: string }) => skill.name),
      ).toContain(family);
      const [job] = await service.enrich(
        "candidate",
        [
          {
            title: "Product UX Jira Figma",
            classification: { primaryFamily: family },
          },
        ],
        [],
        { preferences, notifyHighMatches: false },
      );
      expect(job.matchReasons).not.toContain("família profissional compatível");
    },
  );

  it.each(["product", "product_design"])(
    "maps jobTypes to modality, never contract (%s)",
    async (family) => {
      profileMocks.getPreferences.mockResolvedValue({
        keywords: [],
        remoteOnly: false,
        jobTypes: ["Híbrido", "Presencial"],
        searchLocation: "São Paulo, SP",
      });
      const capture = vi.fn();
      const service = new JobProfileMatchService();
      await service.getUserTechnologies("candidate", capture);
      const preferences = capture.mock.calls[0][0];
      expect(preferences).toMatchObject({
        modalities: ["Híbrido", "Presencial"],
        location: "São Paulo, SP",
      });
      expect(preferences.modality).toBeUndefined();
      expect(preferences.contract).toBeUndefined();
      const jobs = [
        {
          title: "Product UX",
          modality: "híbrido",
          description: "CLT",
          classification: { primaryFamily: family },
        },
        {
          title: "Product UX",
          modality: "remoto",
          description: "CLT",
          classification: { primaryFamily: family },
        },
      ];
      const [hybrid, remote] = await service.enrich("candidate", jobs, [], {
        preferences,
        notifyHighMatches: false,
      });
      expect(hybrid.matchReasons).toEqual(["modalidade compatível"]);
      expect(remote.matchScore).toBeUndefined();
    },
  );

  it("keeps remoteOnly separate from contract and rejects legacy hiring types", async () => {
    profileMocks.getPreferences.mockResolvedValue({
      keywords: ["CLT", "PJ"],
      remoteOnly: true,
      jobTypes: ["CLT", "PJ", "full-time", "part-time", "contract"],
      searchLocation: null,
    });
    const capture = vi.fn();
    await new JobProfileMatchService().getUserTechnologies(
      "candidate",
      capture,
    );
    const preferences = capture.mock.calls[0][0];
    expect(preferences.modality).toBe("remoto");
    expect(preferences.modalities).toEqual([]);
    expect(preferences.contract).toBeUndefined();
    expect(preferences.family).toBeUndefined();
  });

  it.each(["product", "product_design"])(
    "scores explicit contract independently of modality (%s)",
    async (family) => {
      const [job] = await new JobProfileMatchService().enrich(
        "candidate",
        [
          {
            title: "Product UX",
            modality: "presencial",
            description: "CLT",
            classification: { primaryFamily: family },
          },
        ],
        [],
        {
          preferences: { contract: "CLT", modality: "remoto" },
          notifyHighMatches: false,
        },
      );
      expect(job.matchReasons).toEqual(["contrato compatível"]);
    },
  );
});
