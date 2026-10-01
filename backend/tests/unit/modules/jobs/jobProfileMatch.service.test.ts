import { beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  createHighMatchIfMissing: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../../../src/modules/users/users.service", () => ({
  UsersService: class {
    getUserById = profileMocks.getUserById;
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
      expect.objectContaining({ userId: "user-1", error: "database down" }),
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
        userId: "user-1",
        error: "notification store down",
      }),
    );
  });
});
