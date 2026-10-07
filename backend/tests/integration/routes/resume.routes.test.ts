import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/lib/errors";

// ── ResumeService mock ────────────────────────────────────────────────────────

const mockResumeService = vi.hoisted(() => ({
  generateForUser: vi.fn(),
  analyzeForUser: vi.fn(),
}));

vi.mock("../../../src/modules/resume/resume.service", () => ({
  ResumeService: class {
    constructor() {
      return mockResumeService;
    }
  },
}));

// ── iron-session ──────────────────────────────────────────────────────────────

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

import { getIronSession } from "iron-session";
import { createJobsApiApp } from "../../../src/app";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fixtureSession = {
  userId: "user_abc",
  save: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
};

const fixtureAtsReport = {
  score: 82,
  breakdown: {
    keywordCoverage: 80,
    skillsMatch: 90,
    completeness: 75,
    structure: 100,
  },
  matchedKeywords: ["node.js", "typescript"],
  missingKeywords: ["kubernetes"],
  suggestions: ["Adicione um resumo profissional."],
};

const fixtureResume = {
  content: Buffer.from("%PDF-1.3 fake"),
  contentType: "application/pdf",
  filename: "Ana_Souza.pdf",
  atsReport: fixtureAtsReport,
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration - Resume Routes", () => {
  let app: ReturnType<typeof createJobsApiApp>;
  const BASE = "/resume";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIronSession).mockResolvedValue(fixtureSession as any);
    mockResumeService.generateForUser.mockResolvedValue(fixtureResume);
    mockResumeService.analyzeForUser.mockResolvedValue({
      resume: { name: "Ana Souza", skills: {} },
      atsReport: fixtureAtsReport,
      warnings: [],
      sourcesUsed: ["candidate", "github"],
      job: { title: "Backend", hasDescription: true },
    });
    app = createJobsApiApp();
  });

  describe("POST /analyze", () => {
    it("retorna 200 com o preview + análise ATS", async () => {
      const res = await request(app)
        .post(`${BASE}/analyze`)
        .send({ format: "pdf", jobTitle: "Backend", jobDescription: "node.js" })
        .expect(200);

      expect(res.body.resume.name).toBe("Ana Souza");
      expect(res.body.atsReport.score).toBe(82);
      expect(res.body.sourcesUsed).toContain("github");
      expect(mockResumeService.analyzeForUser).toHaveBeenCalledWith(
        "user_abc",
        expect.objectContaining({ format: "pdf" }),
      );
    });

    it("retorna 401 sem sessão", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({ userId: undefined } as any);
      await request(app).post(`${BASE}/analyze`).send({ format: "pdf" }).expect(401);
    });
  });

  describe("POST /generate", () => {
    it("gera o currículo e retorna 200 com o arquivo", async () => {
      const res = await request(app)
        .post(`${BASE}/generate`)
        .send({ format: "pdf" })
        .expect(200);

      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain("Ana_Souza.pdf");
      expect(res.headers["x-ats-score"]).toBe("82");
      expect(res.headers["x-ats-report"]).toBeDefined();
    });

    it("chama o service com o userId da sessão (isolamento por candidato)", async () => {
      await request(app)
        .post(`${BASE}/generate`)
        .send({ format: "docx", jobTitle: "Backend", jobDescription: "Node.js" })
        .expect(200);

      expect(mockResumeService.generateForUser).toHaveBeenCalledWith(
        "user_abc",
        expect.objectContaining({
          format: "docx",
          job: expect.objectContaining({
            title: "Backend",
            description: "Node.js",
          }),
        }),
      );
    });

    it("encaminha os links de GitHub/LinkedIn como sources", async () => {
      await request(app)
        .post(`${BASE}/generate`)
        .send({
          format: "pdf",
          githubUrl: "https://github.com/ana",
          linkedinUrl: "https://www.linkedin.com/in/ana",
        })
        .expect(200);

      expect(mockResumeService.generateForUser).toHaveBeenCalledWith(
        "user_abc",
        expect.objectContaining({
          sources: {
            github: "https://github.com/ana",
            linkedin: "https://www.linkedin.com/in/ana",
          },
        }),
      );
    });

    it("usa formato docx como padrão quando não informado", async () => {
      await request(app).post(`${BASE}/generate`).send({}).expect(200);

      expect(mockResumeService.generateForUser).toHaveBeenCalledWith(
        "user_abc",
        expect.objectContaining({ format: "docx", job: null }),
      );
    });

    it("retorna 400 para formato inválido (Zod)", async () => {
      const res = await request(app)
        .post(`${BASE}/generate`)
        .send({ format: "xlsx" })
        .expect(400);

      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("retorna 401 quando a sessão não tem userId", async () => {
      vi.mocked(getIronSession).mockResolvedValueOnce({
        userId: undefined,
      } as any);

      await request(app).post(`${BASE}/generate`).send({ format: "pdf" }).expect(401);

      expect(mockResumeService.generateForUser).not.toHaveBeenCalled();
    });

    it("retorna 404 quando o usuário não existe", async () => {
      mockResumeService.generateForUser.mockRejectedValueOnce(
        AppError.notFound("Usuário não encontrado"),
      );

      await request(app).post(`${BASE}/generate`).send({ format: "pdf" }).expect(404);
    });

    it("propaga 500 quando o ats-forge está indisponível", async () => {
      mockResumeService.generateForUser.mockRejectedValueOnce(
        AppError.internal("Não foi possível contatar o serviço de geração de currículos."),
      );

      await request(app).post(`${BASE}/generate`).send({ format: "pdf" }).expect(500);
    });
  });
});
