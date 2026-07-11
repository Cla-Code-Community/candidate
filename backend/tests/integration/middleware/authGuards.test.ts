import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("iron-session", () => ({
  getIronSession: vi.fn(),
}));

import { getIronSession } from "iron-session";
import { createJobsApiApp } from "../../../src/app";

const protectedRoutes = [
  { method: "get" as const, path: "/saved-jobs" },
  { method: "get" as const, path: "/users/profile" },
  { method: "get" as const, path: "/jobs/search?keywords=dev" },
  { method: "get" as const, path: "/keywords" },
];

describe("Integration - Auth Guards (requireAuth)", () => {
  let app: ReturnType<typeof createJobsApiApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getIronSession).mockResolvedValue({
      userId: undefined,
      save: vi.fn(),
      destroy: vi.fn(),
    } as any);
    app = createJobsApiApp();
  });

  it.each(protectedRoutes)(
    "bloqueia $method $path sem sessão autenticada",
    async ({ method, path }) => {
      const res = await request(app)[method](path).expect(401);

      expect(res.body).toEqual({
        code: "UNAUTHORIZED",
        message: "Não autenticado.",
      });
    },
  );

  it("permite /auth/login sem exigir autenticação prévia", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "invalido", password: "x" });

    expect(res.status).not.toBe(401);
    expect(res.body).not.toEqual({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
  });

  it("permite /health sem autenticação", async () => {
    await request(app).get("/health").expect(200);
  });
});
