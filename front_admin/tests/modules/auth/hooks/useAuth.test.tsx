import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  id: "u1",
  name: "Admin",
  email: "admin@example.com",
  role: "admin" as const,
  avatar: "",
  permissions: { dashboard: ["read"] },
};

async function loadUseAuth() {
  vi.resetModules();

  const authApi = {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
  const notify = vi.fn();
  class ApiError extends Error {
    status: number;
    body: unknown;

    constructor(status: number, body: unknown) {
      super(`API error ${status}`);
      this.status = status;
      this.body = body;
    }
  }

  vi.doMock("../../../../src/lib/api/auth.api", () => ({ authApi }));
  vi.doMock("../../../../src/lib/api/client", () => ({ ApiError }));
  vi.doMock(
    "../../../../src/components/notifications/useNotifications",
    () => ({
      useNotifications: () => ({ notify }),
    }),
  );

  const { useAuth } = await import("../../../../src/modules/auth/hooks/useAuth");
  return { useAuth, authApi, ApiError, notify };
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads shared session and checks permissions", async () => {
    const { useAuth, authApi } = await loadUseAuth();
    authApi.me.mockResolvedValueOnce({ user: session });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isLoggedIn?.name).toBe("Admin");
    expect(result.current.hasPermission("dashboard", "read")).toBe(true);
    expect(result.current.hasPermission("users", "read")).toBe(false);
  });

  it("logs in successfully and emits notifications", async () => {
    const { useAuth, authApi } = await loadUseAuth();
    authApi.me.mockResolvedValueOnce({ user: null }).mockResolvedValueOnce({
      user: session,
    });
    authApi.login.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let success = false;
    await act(async () => {
      success = await result.current.login({
        email: "admin@example.com",
        password: "12345678",
        rememberMe: false,
      });
    });

    expect(success).toBe(true);
    expect(result.current.isLoggedIn?.id).toBe("u1");
    expect(authApi.login).toHaveBeenCalledTimes(1);
  });

  it("handles invalid login and server login errors", async () => {
    const { useAuth, authApi, ApiError } = await loadUseAuth();
    authApi.me.mockResolvedValue({ user: null });
    authApi.login
      .mockRejectedValueOnce(new Error("invalid"))
      .mockRejectedValueOnce(new ApiError(500, null));

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(
        await result.current.login({
          email: "bad@example.com",
          password: "12345678",
          rememberMe: false,
        }),
      ).toBe(false);
    });
    expect(result.current.errorMessage).toBe("E-mail ou senha inválidos");

    await act(async () => {
      expect(
        await result.current.login({
          email: "bad@example.com",
          password: "12345678",
          rememberMe: false,
        }),
      ).toBe(false);
    });
    expect(result.current.errorMessage).toBe(
      "Servidor indisponível. Tente novamente em alguns instantes.",
    );
  });

  it("loads null session on /me failure and logs out", async () => {
    const { useAuth, authApi } = await loadUseAuth();
    authApi.me.mockRejectedValueOnce(new Error("offline"));
    authApi.logout.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isLoggedIn).toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggedIn).toBeNull();
  });
});
