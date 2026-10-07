import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAppError } from "../../../src/lib/errors";
import type { NormalizedProfile } from "../../../src/modules/resume/resume.types";

const mockConfig = vi.hoisted(() => ({
  atsForgeUrl: "http://ats-forge:8089",
  atsForgeApiKey: "",
}));

vi.mock("../../../src/config", () => ({ config: mockConfig }));

import { resumeClient } from "../../../src/modules/resume/resume.client";

const profile: NormalizedProfile = {
  name: "Ana",
  contact: {},
  experience: [],
  education: [],
  skills: [],
  projects: [],
  links: [],
  languages: [],
};

function makeResponse(
  opts: Partial<{
    ok: boolean;
    status: number;
    headers: Record<string, string>;
    json: unknown;
    buffer: Buffer;
  }>,
): Response {
  const headers = new Map(
    Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
    json: () => Promise.resolve(opts.json ?? {}),
    arrayBuffer: () =>
      Promise.resolve(
        (opts.buffer ?? Buffer.from("%PDF-1.3")).buffer.slice(0),
      ),
  } as unknown as Response;
}

const report = { score: 88, matchedKeywords: ["node.js"] };
const reportB64 = Buffer.from(JSON.stringify(report), "utf-8").toString("base64");

beforeEach(() => {
  mockConfig.atsForgeApiKey = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resumeClient.generate", () => {
  it("retorna conteúdo, contentType, filename e atsReport no sucesso", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          makeResponse({
            headers: {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="Ana.pdf"',
              "x-ats-report": reportB64,
            },
            buffer: Buffer.from("%PDF-1.3 data"),
          }),
        ),
      ),
    );

    const result = await resumeClient.generate({ profile, format: "pdf" });

    expect(result.contentType).toBe("application/pdf");
    expect(result.filename).toBe("Ana.pdf");
    expect(result.atsReport?.score).toBe(88);
    expect(Buffer.isBuffer(result.content)).toBe(true);
  });

  it("usa fallback de filename e contentType quando headers ausentes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(makeResponse({ headers: {} }))),
    );

    const result = await resumeClient.generate({ profile, format: "docx" });
    expect(result.filename).toBe("curriculo.docx");
    expect(result.contentType).toBe("application/octet-stream");
    expect(result.atsReport).toBeNull();
  });

  it("retorna atsReport null quando o header é base64 inválido", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(makeResponse({ headers: { "x-ats-report": "@@nao-base64@@" } })),
      ),
    );
    const result = await resumeClient.generate({ profile, format: "pdf" });
    expect(result.atsReport).toBeNull();
  });

  it("envia o header x-api-key quando configurado", async () => {
    mockConfig.atsForgeApiKey = "secret";
    const fetchMock = vi.fn(() => Promise.resolve(makeResponse({ headers: {} })));
    vi.stubGlobal("fetch", fetchMock);

    await resumeClient.generate({ profile, format: "pdf" });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("secret");
  });

  it("mapeia HTTP 400 para AppError de validação", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          makeResponse({ ok: false, status: 400, json: { message: "Perfil inválido", details: {} } }),
        ),
      ),
    );

    await expect(resumeClient.generate({ profile, format: "pdf" })).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.statusCode === 400,
    );
  });

  it("usa mensagem padrão no 400 quando o corpo não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          headers: { get: () => null },
          json: () => Promise.reject(new Error("not json")),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        } as unknown as Response),
      ),
    );
    await expect(resumeClient.generate({ profile, format: "pdf" })).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.statusCode === 400,
    );
  });

  it("cai no filename de fallback quando o Content-Disposition não traz filename", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(makeResponse({ headers: { "content-disposition": "attachment" } })),
      ),
    );
    const result = await resumeClient.generate({ profile, format: "md" });
    expect(result.filename).toBe("curriculo.md");
  });

  it("analyze retorna o JSON de análise do ats-forge", async () => {
    const analysis = { resume: { name: "Ana" }, atsReport: { score: 90 }, sourcesUsed: ["candidate"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(makeResponse({ headers: {}, json: analysis })),
      ),
    );

    const result = await resumeClient.analyze({ profile, format: "pdf" });
    expect(result).toEqual(analysis);
  });

  it("analyze propaga erro de validação (400)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(makeResponse({ ok: false, status: 400, json: { message: "x" } }))),
    );
    await expect(resumeClient.analyze({ profile, format: "pdf" })).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.statusCode === 400,
    );
  });

  it("mapeia HTTP não-ok para AppError interno", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(makeResponse({ ok: false, status: 503 }))),
    );

    await expect(resumeClient.generate({ profile, format: "pdf" })).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.statusCode === 500,
    );
  });

  it("mapeia falha de rede para AppError interno", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))),
    );

    await expect(resumeClient.generate({ profile, format: "pdf" })).rejects.toSatisfy(
      (e: unknown) => isAppError(e) && e.statusCode === 500,
    );
  });
});
