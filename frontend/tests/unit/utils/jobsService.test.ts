import { fetchJobFiles, fetchJobsByFile, fetchKeywords, saveKeywords } from "@/domains/jobs/infrastructure/jobsApi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("jobsService", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("retorna lista de arquivos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ files: [{ file: "vagas.xlsx" }] }) })),
    );

    const files = await fetchJobFiles();
    expect(files).toEqual([{ file: "vagas.xlsx" }]);
  });

  it("usa a URL da VPS quando VITE_API_BASE_URL estiver configurada", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://jobsglobalscraper.ddns.net/");
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ files: [] }) }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJobFiles();
    expect(fetchMock).toHaveBeenCalledWith("https://jobsglobalscraper.ddns.net/jobs/files", { credentials: "include" });
  });

  it("filtra entradas invalidas ao listar arquivos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ files: [{ file: "ok.xlsx" }, null, { file: 1 }] }) })),
    );

    const files = await fetchJobFiles();
    expect(files).toEqual([{ file: "ok.xlsx" }]);
  });

  it("retorna lista vazia quando payload nao possui files array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ files: "invalido" }) })));

    const files = await fetchJobFiles();
    expect(files).toEqual([]);
  });

  it("lanca erro com mensagem da API ao listar arquivos", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ message: "erro-listagem" }) })),
    );

    await expect(fetchJobFiles()).rejects.toThrow("erro-listagem");
  });

  it("lanca erro padrao ao listar arquivos sem mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));

    await expect(fetchJobFiles()).rejects.toThrow("Falha ao listar arquivos de vagas.");
  });

  it("retorna jobs por arquivo", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jobs: [{ titulo: "Dev" }], file: "vagas.xlsx", modifiedAt: 1, total: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchJobsByFile("vagas.xlsx");
    expect(response.total).toBe(1);
    expect(response.file).toBe("vagas.xlsx");
    expect(fetchMock).toHaveBeenCalledWith("/jobs?file=vagas.xlsx", { credentials: "include" });
  });

  it("usa endpoint sem sufixo quando fileName vazio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ jobs: [{ titulo: "Dev" }], file: "vagas.xlsx", modifiedAt: 1, total: 1 }),
      })),
    );

    await fetchJobsByFile("");
    expect(fetch).toHaveBeenCalledWith("/jobs", { credentials: "include" });
  });

  it("normaliza payload invalido ao buscar jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ jobs: "x", file: 7, modifiedAt: {}, total: null }) })),
    );

    const response = await fetchJobsByFile("vagas com espaco.xlsx");
    expect(response).toEqual({ jobs: [], file: "", modifiedAt: null, total: 0 });
    expect(fetch).toHaveBeenCalledWith("/jobs?file=vagas%20com%20espaco.xlsx", { credentials: "include" });
  });

  it("lanca erro com mensagem da API ao buscar jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ message: "erro-jobs" }) })),
    );

    await expect(fetchJobsByFile("vagas.xlsx")).rejects.toThrow("erro-jobs");
  });

  it("lanca erro padrao ao buscar jobs sem mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));

    await expect(fetchJobsByFile("vagas.xlsx")).rejects.toThrow("Falha ao carregar vagas.");
  });

  it("retorna lista de keywords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ keywords: ["react", "typescript"] }),
      })),
    );

    const keywords = await fetchKeywords();
    expect(keywords).toEqual(["react", "typescript"]);
  });

  it("retorna lista vazia quando payload nao possui keywords array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ keywords: null }),
      })),
    );

    const keywords = await fetchKeywords();
    expect(keywords).toEqual([]);
  });

  it("lanca erro ao falhar no carregamento das keywords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "erro-api" }),
      })),
    );

    await expect(fetchKeywords()).rejects.toThrow("erro-api");
  });

  it("lanca erro legivel quando a resposta nao e JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        headers: { get: () => "text/plain; charset=utf-8" },
        text: async () => "Vercel rewrite nao encontrado.",
      })),
    );

    await expect(fetchKeywords()).rejects.toThrow("Vercel rewrite nao encontrado.");
  });

  it("salva keywords com sucesso", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await saveKeywords(["node", "vitest"]);
    expect(fetchMock).toHaveBeenCalledWith("/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: ["node", "vitest"] }),
      credentials: "include",
    });
  });

  it("lanca erro ao falhar no salvamento das keywords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "erro-save" }),
      })),
    );

    await expect(saveKeywords([])).rejects.toThrow("erro-save");
  });
});
