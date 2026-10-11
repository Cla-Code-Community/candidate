import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAppError } from "../../../src/lib/errors";

const mockFindById = vi.hoisted(() => vi.fn());
const mockGenerate = vi.hoisted(() => vi.fn());
const mockAnalyze = vi.hoisted(() => vi.fn());

vi.mock("../../../src/modules/users/users.repository", () => ({
  UsersRepository: class {
    findById = mockFindById;
  },
}));

vi.mock("../../../src/modules/resume/resume.client", () => ({
  resumeClient: { generate: mockGenerate, analyze: mockAnalyze },
}));

import { ResumeService } from "../../../src/modules/resume/resume.service";

const user = {
  id: "u1",
  displayName: "Ana Souza",
  firstName: "Ana",
  lastName: "Souza",
  email: "ana@example.com",
  phone: "+55 11 90000-0000",
  technologies: ["TypeScript"],
  technologyExperiences: [{ name: "TypeScript", years: 5 }],
  level: "Pleno",
};

const generated = {
  content: Buffer.from("%PDF"),
  contentType: "application/pdf",
  filename: "Ana.pdf",
  atsReport: null,
};

describe("ResumeService.generateForUser", () => {
  let service: ResumeService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue(user);
    mockGenerate.mockResolvedValue(generated);
    mockAnalyze.mockResolvedValue({ resume: { name: "Ana Souza" }, atsReport: { score: 90 } });
    service = new ResumeService({} as never);
  });

  it("analyzeForUser monta o perfil e chama o client.analyze", async () => {
    const result = await service.analyzeForUser("u1", {
      format: "pdf",
      job: { title: "Backend" },
      sources: { github: "https://github.com/ana" },
    });
    expect(result).toMatchObject({ atsReport: { score: 90 } });
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(mockAnalyze.mock.calls[0][0].profile.name).toBe("Ana Souza");
    expect(mockAnalyze.mock.calls[0][0].sources).toEqual({ github: "https://github.com/ana" });
  });

  it("analyzeForUser usa job/sources null quando ausentes", async () => {
    await service.analyzeForUser("u1", { format: "docx" });
    const arg = mockAnalyze.mock.calls[0][0];
    expect(arg.job).toBeNull();
    expect(arg.sources).toBeNull();
  });

  it("analyzeForUser lança notFound quando o usuário não existe", async () => {
    mockFindById.mockResolvedValueOnce(undefined);
    await expect(
      service.analyzeForUser("ghost", { format: "pdf" }),
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.statusCode === 404);
  });

  it("lança notFound quando o usuário não existe", async () => {
    mockFindById.mockResolvedValueOnce(undefined);
    await expect(
      service.generateForUser("ghost", { format: "pdf" }),
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.statusCode === 404);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("monta o perfil normalizado e chama o ats-forge (sem experiência)", async () => {
    const result = await service.generateForUser("u1", {
      format: "pdf",
      job: { title: "Backend" },
      sources: { github: "https://github.com/ana" },
      about: "Engenheiro backend focado em integrações.",
    });

    expect(result).toBe(generated);
    const arg = mockGenerate.mock.calls[0][0];
    expect(arg.profile.name).toBe("Ana Souza");
    expect(arg.profile.experience).toEqual([]);
    expect(arg.job).toEqual({ title: "Backend" });
    expect(arg.sources).toEqual({ github: "https://github.com/ana" });
    expect(arg.about).toBe("Engenheiro backend focado em integrações.");
  });

  it("inclui experiências manuais quebrando a descrição em bullets", async () => {
    await service.generateForUser("u1", {
      format: "pdf",
      experiences: [
        {
          company: "Empresa A",
          role: "Dev",
          period: "2021 – Atual",
          description: "- Fiz APIs\n• Otimizei queries\n\nAutomatizei deploys",
          stack: ["Node.js"],
        },
      ],
    });

    const arg = mockGenerate.mock.calls[0][0];
    expect(arg.profile.experience).toHaveLength(1);
    expect(arg.profile.experience[0]).toMatchObject({
      company: "Empresa A",
      role: "Dev",
      period: "2021 – Atual",
      stack: ["Node.js"],
      source: "manual",
    });
    expect(arg.profile.experience[0].highlights).toEqual([
      "Fiz APIs",
      "Otimizei queries",
      "Automatizei deploys",
    ]);
  });

  it("trata experiência sem descrição (highlights vazios)", async () => {
    await service.generateForUser("u1", {
      format: "pdf",
      experiences: [{ company: "X", role: "Y" }],
    });
    const arg = mockGenerate.mock.calls[0][0];
    expect(arg.profile.experience[0].highlights).toEqual([]);
  });

  it("passa job/sources como null quando ausentes", async () => {
    await service.generateForUser("u1", { format: "docx" });
    const arg = mockGenerate.mock.calls[0][0];
    expect(arg.job).toBeNull();
    expect(arg.sources).toBeNull();
  });
});
