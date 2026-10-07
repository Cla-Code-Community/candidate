import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAppError } from "../../../src/lib/errors";

vi.mock("iron-session", () => ({ getIronSession: vi.fn() }));

import { getIronSession } from "iron-session";
import { ResumeController } from "../../../src/modules/resume/resume.controller";

function makeRes() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const baseGenerated = {
  content: Buffer.from("%PDF"),
  contentType: "application/pdf",
  filename: "Ana.pdf",
  atsReport: { score: 90 },
};

describe("ResumeController.generate", () => {
  const service = { generateForUser: vi.fn(), analyzeForUser: vi.fn() };
  const controller = new ResumeController(service as never);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIronSession).mockResolvedValue({ userId: "u1" } as never);
    service.generateForUser.mockResolvedValue(baseGenerated);
    service.analyzeForUser.mockResolvedValue({ resume: { name: "Ana" }, atsReport: { score: 90 } });
  });

  it("analyze retorna o JSON da análise", async () => {
    const res = makeRes();
    await controller.analyze(
      { body: { format: "pdf", jobTitle: "Backend" } } as Request,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const arg = service.analyzeForUser.mock.calls[0][1];
    expect(arg.job).toMatchObject({ title: "Backend" });
  });

  it("analyze exige autenticação", async () => {
    vi.mocked(getIronSession).mockResolvedValueOnce({} as never);
    const res = makeRes();
    await expect(
      controller.analyze({ body: {} } as Request, res),
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.statusCode === 401);
  });

  it("lança unauthorized quando a sessão não tem userId", async () => {
    vi.mocked(getIronSession).mockResolvedValueOnce({} as never);
    const res = makeRes();
    await expect(
      controller.generate({ body: {} } as Request, res),
    ).rejects.toSatisfy((e: unknown) => isAppError(e) && e.statusCode === 401);
    expect(service.generateForUser).not.toHaveBeenCalled();
  });

  it("gera e envia o arquivo com headers de ATS score", async () => {
    const res = makeRes();
    await controller.generate(
      {
        body: {
          format: "pdf",
          jobTitle: "Backend",
          githubUrl: "https://github.com/ana",
          experiences: [{ company: "A", role: "Dev" }],
        },
      } as Request,
      res,
    );

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("X-Ats-Score", "90");
    expect(res.send).toHaveBeenCalledWith(baseGenerated.content);

    const arg = service.generateForUser.mock.calls[0][1];
    expect(arg.job).toMatchObject({ title: "Backend" });
    expect(arg.sources).toMatchObject({ github: "https://github.com/ana" });
    expect(arg.experiences).toHaveLength(1);
  });

  it("não define headers de score quando não há atsReport", async () => {
    service.generateForUser.mockResolvedValueOnce({ ...baseGenerated, atsReport: null });
    const res = makeRes();
    await controller.generate({ body: { format: "docx" } } as Request, res);

    const scoreCall = res.setHeader.mock.calls.find((c) => c[0] === "X-Ats-Score");
    expect(scoreCall).toBeUndefined();

    const arg = service.generateForUser.mock.calls[0][1];
    expect(arg.job).toBeNull();
    expect(arg.sources).toBeNull();
    expect(arg.experiences).toBeNull();
  });
});
