import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../../../src/lib/api/auth.api";
import { api } from "../../../src/lib/api/client";

vi.mock("../../../src/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes /auth/me responses wrapped in user", async () => {
    mockedApi.get.mockResolvedValueOnce({
      user: {
        id: "u1",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        role: "admin",
        avatarUrl: null,
      },
    });

    await expect(authApi.me()).resolves.toEqual({
      user: expect.objectContaining({
        id: "u1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
        permissions: expect.objectContaining({
          dashboard: ["read"],
          scrapers: ["read", "trigger"],
        }),
      }),
    });
  });

  it("normalizes raw user responses and prefers displayName", async () => {
    mockedApi.get.mockResolvedValueOnce({
      id: "u2",
      displayName: "Grace",
      username: "grace",
      email: null,
      role: "super_admin",
      avatarUrl: "avatar.png",
    });

    const result = await authApi.me();

    expect(result.user.name).toBe("Grace");
    expect(result.user.avatar).toBe("avatar.png");
    expect(result.user.permissions.users).toContain("delete");
  });

  it("rejects invalid /auth/me payloads", async () => {
    mockedApi.get.mockResolvedValueOnce({ user: { id: "u1", role: "owner" } });

    await expect(authApi.me()).rejects.toThrow("Resposta inválida de /auth/me");
  });

  it("logs in, logs out ignoring failures, and builds oauth url", async () => {
    mockedApi.post.mockResolvedValueOnce(undefined);
    await authApi.login({
      email: "admin@example.com",
      password: "12345678",
      rememberMe: true,
    });

    mockedApi.post.mockRejectedValueOnce(new Error("offline"));
    await expect(authApi.logout()).resolves.toBeUndefined();

    expect(mockedApi.post).toHaveBeenNthCalledWith(1, "/auth/login", {
      email: "admin@example.com",
      password: "12345678",
      rememberMe: true,
    });
    expect(mockedApi.post).toHaveBeenNthCalledWith(2, "/auth/logout");
    expect(authApi.oauthUrl("google")).toContain("/auth/google/url");
  });
});
