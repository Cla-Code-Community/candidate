/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as any;

import * as auth from "@/domains/auth/infrastructure/authApi";

function mockResponse({
  ok = true,
  status = 200,
  statusText = "OK",
  jsonData = {},
  textData = "",
  contentType = "application/json",
}: any) {
  return {
    ok,
    status,
    statusText,
    headers: {
      get: (key: string) => {
        if (key === "content-type") return contentType;
        return null;
      },
    },
    json: vi.fn().mockResolvedValue(jsonData),
    text: vi.fn().mockResolvedValue(textData),
  };
}

describe("authService", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("should login successfully", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { token: "abc", user: { id: 1, email: "test@test.com" } },
        })
      );

      const result = await auth.login({
        email: "test@test.com",
        password: "123456",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/login"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
      );

      expect(result.token).toBe("abc");
      expect(result.user.email).toBe("test@test.com");
    });

    it("should throw error on login failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 401,
          jsonData: { message: "Invalid credentials" },
        })
      );

      await expect(
        auth.login({ email: "x@x.com", password: "wrong" })
      ).rejects.toThrow("Invalid credentials");
    });

    it("should throw error on login failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(
        auth.login({ email: "x@x.com", password: "wrong" })
      ).rejects.toThrow("Falha ao fazer login.");
    });
  });

  describe("register", () => {
    it("should register successfully", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { message: "User created", user: { id: 1, email: "new@test.com" } },
        })
      );

      const result = await auth.register({
        email: "new@test.com",
        password: "123456",
        name: "New User",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/register"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );

      expect(result.user.id).toBe(1);
    });

    it("should register with optional fields", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { message: "User created", user: { id: 1 } },
        })
      );

      const result = await auth.register({
        email: "new@test.com",
        password: "123456",
        name: "New User",
        phone: "+5511999999999",
        cpf: "12345678901",
      });

      expect(result.user.id).toBe(1);

      const callArgs = fetchMock.mock.calls[0][1];

      expect(JSON.parse(callArgs.body)).toEqual({
        email: "new@test.com",
        password: "123456",
        name: "New User",
        phone: "+5511999999999",
        cpf: "12345678901",
      });
    });

    it("should throw error on register failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 400,
          jsonData: { message: "Email already exists" },
        })
      );

      await expect(
        auth.register({
          email: "existing@test.com",
          password: "123456",
          name: "Existing",
        })
      ).rejects.toThrow("Email already exists");
    });

    it("should throw error on register failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(
        auth.register({
          email: "test@test.com",
          password: "123456",
          name: "Test",
        })
      ).rejects.toThrow("Falha ao cadastrar.");
    });
  });

  describe("logout", () => {

    it("should throw on logout failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: { message: "Session expired" },
        })
      );

      await expect(auth.logout()).rejects.toThrow("Session expired");
    });

    it("should throw on logout failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(auth.logout()).rejects.toThrow("Falha ao fazer logout.");
    });
  });

  describe("getCurrentUser", () => {
    it("should get current user successfully", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { id: 1, name: "Bene", email: "bene@test.com" },
        })
      );

      const user = await auth.getCurrentUser();

      expect(user.name).toBe("Bene");
      expect(user.email).toBe("bene@test.com");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/me"),
        { credentials: "include" }
      );
    });

    it("should throw when getCurrentUser fails with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 401,
          jsonData: { message: "Not authenticated" },
        })
      );

      await expect(auth.getCurrentUser()).rejects.toThrow("Not authenticated");
    });

    it("should throw when getCurrentUser fails without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 403,
          jsonData: {},
        })
      );

      await expect(auth.getCurrentUser()).rejects.toThrow(
        "Falha ao carregar usuário."
      );
    });
  });

  describe("getGithubAuthUrl", () => {
    it("should return Github auth URL on success", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { url: "https://github.com/login/oauth/authorize?state=abc" },
        })
      );

      const url = await auth.getGithubAuthUrl();

      expect(url).toBe("https://github.com/login/oauth/authorize?state=abc");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/github/url"),
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("should throw error on failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: { message: "Provider unavailable" },
        })
      );

      await expect(auth.getGithubAuthUrl()).rejects.toThrow("Provider unavailable");
    });

    it("should throw error on failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(auth.getGithubAuthUrl()).rejects.toThrow(
        "Falha ao obter URL de autenticacao Github."
      );
    });
  });

  describe("getGoogleAuthUrl", () => {
    it("should return Google auth URL on success", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { url: "https://accounts.google.com/o/oauth2/auth?state=abc" },
        })
      );

      const url = await auth.getGoogleAuthUrl();

      expect(url).toBe("https://accounts.google.com/o/oauth2/auth?state=abc");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/google/url"),
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("should throw error on failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: { message: "Provider unavailable" },
        })
      );

      await expect(auth.getGoogleAuthUrl()).rejects.toThrow("Provider unavailable");
    });

    it("should throw error on failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(auth.getGoogleAuthUrl()).rejects.toThrow(
        "Falha ao obter URL de autenticacao Google."
      );
    });
  });

  describe("getLinkedinAuthUrl", () => {
    it("should return LinkedIn auth URL on success", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          jsonData: { url: "https://www.linkedin.com/oauth/v2/authorization?state=abc" },
        })
      );

      const url = await auth.getLinkedinAuthUrl();

      expect(url).toBe("https://www.linkedin.com/oauth/v2/authorization?state=abc");
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/linkedin/url"),
        expect.objectContaining({ credentials: "include" })
      );
    });

    it("should throw error on failure with message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: { message: "Provider unavailable" },
        })
      );

      await expect(auth.getLinkedinAuthUrl()).rejects.toThrow("Provider unavailable");
    });

    it("should throw error on failure without message", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          jsonData: {},
        })
      );

      await expect(auth.getLinkedinAuthUrl()).rejects.toThrow(
        "Falha ao obter URL de autenticacao LinkedIn."
      );
    });
  });
});