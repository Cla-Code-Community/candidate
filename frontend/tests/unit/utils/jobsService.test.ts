import { fetchJobsByAPI, fetchKeywords, saveKeywords, runScraperRequest } from "@/domains/jobs/infrastructure/jobsApi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("jobsService", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("usa a URL da VPS quando VITE_API_BASE_URL estiver configurada", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.candidate.app.br");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jobs: [], total: 0 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJobsByAPI();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.candidate.app.br/jobs/search",
      { credentials: "include" }
    );
  });

  it("lanca erro com mensagem da API ao carregar jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "erro-carregamento" }),
      })),
    );

    await expect(fetchJobsByAPI()).rejects.toThrow("erro-carregamento");
  });

  it("lanca erro padrao ao carregar jobs sem mensagem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    await expect(fetchJobsByAPI()).rejects.toThrow("Falha ao carregar vagas.");
  });

  it("retorna jobs e metadados da API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ jobs: [{ title: "Dev" }], total: 1 }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchJobsByAPI();
    expect(response.total).toBe(1);
    expect(response.jobs).toHaveLength(1);
    expect(response.jobs[0].title).toBe("Dev");
    expect(fetchMock).toHaveBeenCalledWith("/jobs/search", { credentials: "include" });
  });

  it("normaliza payload invalido ao buscar jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ jobs: "x", total: null, hasNext: null }),
      })),
    );

    const response = await fetchJobsByAPI();
    expect(response).toEqual({
      jobs: [],
      total: 0,
      hasNext: false,
      hasPrev: false,
      page: 0,
      limit: 0,
      totalPages: 0,
    });
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

  it("executa scraper com sucesso", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await runScraperRequest();
    expect(fetchMock).toHaveBeenCalledWith("/jobs/search", {
      method: "POST",
      credentials: "include",
    });
  });

  it("lanca erro ao falhar no scraper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ message: "erro-scraper" }),
      })),
    );

    await expect(runScraperRequest()).rejects.toThrow("erro-scraper");
  });
});
