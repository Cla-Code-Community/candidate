import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cacheSearchKeywords: vi.fn(),
  cacheAbsoluteSMembers: vi.fn(),
  cacheGetJobsByIds: vi.fn(),
  getCache: vi.fn(),
  publish: vi.fn(),
  logWarn: vi.fn(),
  parsePagination: vi.fn(),
  paginate: vi.fn(),
  dbOrderBy: vi.fn(),
  dbWhere: vi.fn(),
  dbInsert: vi.fn(),
  dbInsertValues: vi.fn(),
  dbInsertConflict: vi.fn(),
}));

vi.mock("../../src/lib/cache.js", () => ({
  cacheSearchKeywords: mocks.cacheSearchKeywords,
  cacheAbsoluteSMembers: mocks.cacheAbsoluteSMembers,
  cacheGetJobsByIds: mocks.cacheGetJobsByIds,
  getCache: mocks.getCache,
}));

vi.mock("../../src/lib/kwsync.js", () => ({
  publish: mocks.publish,
}));

vi.mock("../../src/lib/pagination.js", () => ({
  parsePagination: mocks.parsePagination,
  paginate: mocks.paginate,
}));

vi.mock("../../src/db/client.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mocks.dbWhere,
      }),
    }),
    insert: mocks.dbInsert,
  },
}));

vi.mock("../../src/db/schema.js", () => ({
  keywords: {
    userId: "userId",
    keyword: "keyword",
    source: "source",
    createdAt: "createdAt",
  },
}));

vi.mock("../../src/logger.js", () => ({
  logWarn: mocks.logWarn,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../../src/routes/auth.routes.js", async () => {
  const { Router } = await import("express");
  return { authRoutes: Router() };
});

vi.mock("../../src/routes/savedJobs.routes.js", async () => {
  const { Router } = await import("express");
  return { savedJobsRoutes: Router() };
});

vi.mock("../../src/routes/users.routes.js", async () => {
  const { Router } = await import("express");
  return { userRoutes: Router() };
});

vi.mock("../../src/middleware/withSession.js", () => ({
  withSession: (req: any, _res: any, next: any) => {
    req.session = { userId: "test-user-id" };
    next();
  },
}));

import { createJobsApiApp } from "../../src/app.js";

const DEFAULT_PAGINATION = { page: 1, limit: 100 };
const DEFAULT_PAGINATED = (ids: string[]) => ({
  data: ids,
  pagination: {
    total: ids.length,
    page: 1,
    limit: 100,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
});

describe("jobsApiApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.parsePagination.mockReturnValue(DEFAULT_PAGINATION);
    mocks.paginate.mockImplementation((ids: string[]) =>
      DEFAULT_PAGINATED(ids),
    );
    mocks.cacheSearchKeywords.mockResolvedValue(["id-1", "id-2"]);
    mocks.cacheAbsoluteSMembers.mockResolvedValue(["id-1", "id-2"]);
    mocks.cacheGetJobsByIds.mockResolvedValue([
      { id: "id-1", title: "Dev Java", company: "ACME" },
      { id: "id-2", title: "Dev Node", company: "Globo" },
    ]);
    mocks.dbOrderBy.mockResolvedValue([
      { keyword: "Java", source: "user" },
      { keyword: "Node.js", source: "user" },
    ]);
    mocks.dbWhere.mockReturnValue({ orderBy: mocks.dbOrderBy });
    mocks.dbInsertConflict.mockResolvedValue(undefined);
    mocks.dbInsertValues.mockReturnValue({
      onConflictDoNothing: mocks.dbInsertConflict,
    });
    mocks.dbInsert.mockReturnValue({ values: mocks.dbInsertValues });
    mocks.getCache.mockResolvedValue({ lPush: vi.fn() });
    mocks.publish.mockResolvedValue(undefined);
  });

  // ── health ────────────────────────────────────────────────────────────

  it("GET /health retorna ok", async () => {
    const app = createJobsApiApp();
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  // ── CORS ──────────────────────────────────────────────────────────────

  it("permite CORS para origem autorizada", async () => {
    const app = createJobsApiApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173")
      .expect(200);

    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
  });

  it("bloqueia origens não autorizadas", async () => {
    const app = createJobsApiApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://malicioso.example")
      .expect(403);

    expect(res.body).toEqual({
      code: "FORBIDDEN",
      message: "Origem não permitida.",
    });
  });

  it("bloqueia previews do Vercel fora da allowlist explícita", async () => {
    const app = createJobsApiApp();
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://painel-vagas-preview.vercel.app")
      .expect(403);

    expect(res.body.message).toBe("Origem não permitida.");
  });

  it("usa origens do CORS_ALLOWED_ORIGINS quando definido", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://meuapp.com";
    const app = createJobsApiApp();

    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://meuapp.com")
      .expect(200);

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://meuapp.com",
    );

    const blocked = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173")
      .expect(403);

    expect(blocked.body).toEqual({
      code: "FORBIDDEN",
      message: "Origem não permitida.",
    });
    delete process.env.CORS_ALLOWED_ORIGINS;
  });

  // ── security headers ──────────────────────────────────────────────────

  it("adiciona headers de segurança", async () => {
    const app = createJobsApiApp();
    const res = await request(app).get("/health").expect(200);

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  // ── jobs/search ───────────────────────────────────────────────────────

  it("GET /jobs/search com keywords filtra via cacheSearchKeywords", async () => {
    const app = createJobsApiApp();
    const res = await request(app)
      .get("/jobs/search")
      .query({ keywords: "React,Node.js" })
      .expect(200);

    expect(mocks.cacheSearchKeywords).toHaveBeenCalledWith([
      "React",
      "Node.js",
    ]);
    expect(mocks.cacheAbsoluteSMembers).not.toHaveBeenCalled();
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body.source).toContain("valkey_filtered_by_keywords");
  });

  it("GET /jobs/search sem keywords usa índice global", async () => {
    const app = createJobsApiApp();
    const res = await request(app).get("/jobs/search").expect(200);

    expect(mocks.cacheAbsoluteSMembers).toHaveBeenCalledWith(
      "scraper:jobs:index",
    );
    expect(mocks.cacheSearchKeywords).not.toHaveBeenCalled();
    expect(res.body.source).toBe("valkey_global_index");
  });

  it("GET /jobs/search retorna paginação correta", async () => {
    mocks.parsePagination.mockReturnValue({ page: 2, limit: 10 });
    mocks.paginate.mockReturnValue({
      data: ["id-1"],
      pagination: {
        total: 15,
        page: 2,
        limit: 10,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      },
    });
    mocks.cacheGetJobsByIds.mockResolvedValue([
      { id: "id-1", title: "Dev", company: "ACME" },
    ]);

    const app = createJobsApiApp();
    const res = await request(app)
      .get("/jobs/search")
      .query({ page: "2", limit: "10" })
      .expect(200);

    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
    expect(res.body.total).toBe(15);
    expect(res.body.hasPrev).toBe(true);
    expect(res.body.hasNext).toBe(false);
  });

  it("GET /jobs/search retorna 500 quando cacheSearchKeywords falha", async () => {
    mocks.cacheSearchKeywords.mockRejectedValueOnce(new Error("valkey down"));
    const app = createJobsApiApp();

    const res = await request(app)
      .get("/jobs/search")
      .query({ keywords: "Java" })
      .expect(500);

    expect(res.body.message).toBe("Erro ao recuperar vagas em memória.");
    expect(res.body.error).toBe("valkey down");
    expect(mocks.logWarn).toHaveBeenCalled();
  });

  it("GET /jobs/search retorna 500 quando cacheAbsoluteSMembers falha", async () => {
    mocks.cacheAbsoluteSMembers.mockRejectedValueOnce(new Error("valkey down"));
    const app = createJobsApiApp();

    const res = await request(app).get("/jobs/search").expect(500);

    expect(res.body.message).toBe("Erro ao recuperar vagas em memória.");
  });

  // ── keywords ──────────────────────────────────────────────────────────

  it("GET /keywords retorna keywords do banco", async () => {
    const app = createJobsApiApp();
    const res = await request(app).get("/keywords").expect(200);

    expect(res.body).toEqual({
      ok: true,
      keywords: [
        { keyword: "Java", source: "user" },
        { keyword: "Node.js", source: "user" },
      ],
    });
  });

  it("GET /keywords retorna 500 quando db falha", async () => {
    // Sobrescreve o mock estático do db para rejeitar nessa chamada
    const { db } = await import("../../src/db/client.js");
    vi.spyOn(db, "select").mockImplementationOnce(() => {
      throw new Error("db down");
    });

    const app = createJobsApiApp();
    const res = await request(app).get("/keywords").expect(500);
    expect(res.body.message).toBe("Erro ao buscar keywords.");
  });

  it("POST /keywords enfileira keyword e retorna 202", async () => {
    const app = createJobsApiApp();
    const res = await request(app)
      .post("/keywords")
      .send({ keyword: "Rust" })
      .expect(202);

    expect(mocks.getCache).toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledWith(
      expect.anything(),
      "Rust",
      "user",
      "test-user-id",
    );
    expect(mocks.dbInsertValues).toHaveBeenCalledWith({
      keyword: "Rust",
      source: "user",
      userId: "test-user-id",
    });
    expect(res.body).toEqual({
      ok: true,
      message: "Keyword enfileirada para processamento.",
    });
  });

  it("POST /keywords retorna 400 quando keyword está ausente", async () => {
    const app = createJobsApiApp();

    const res = await request(app).post("/keywords").send({}).expect(400);

    expect(res.body.message).toBe(
      "O campo 'keyword' deve ser uma string não vazia.",
    );
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("POST /keywords retorna 400 quando keyword é string vazia", async () => {
    const app = createJobsApiApp();

    const res = await request(app)
      .post("/keywords")
      .send({ keyword: "   " })
      .expect(400);

    expect(res.body.message).toBe(
      "O campo 'keyword' deve ser uma string não vazia.",
    );
  });

  it("POST /keywords retorna 400 quando keyword não é string", async () => {
    // Arrays não são strings — a rota rejeita com 400 se keyword.trim() não existir
    // ou com 500 se explodir antes. Ajusta a expectativa ao comportamento real da rota:
    // req.body?.keyword?.trim() em um array retorna undefined → cai no if → 400
    // Para garantir 400, envie um tipo que passe pelo optional chaining mas falhe no trim:
    const app = createJobsApiApp();

    const res = await request(app)
      .post("/keywords")
      .send({ keyword: 123 }) // número: typeof !== "string" → falha na guard
      .expect(400);

    expect(res.body.message).toBe(
      "O campo 'keyword' deve ser uma string não vazia.",
    );
  });
});
