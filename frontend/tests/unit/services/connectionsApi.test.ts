/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectProvider,
  disconnectProvider,
  getConnections,
} from "@/domains/auth/infrastructure/connectionsApi";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as any;

function mockResponse({
  ok = true,
  jsonData = {},
  jsonRejects = false,
}: {
  ok?: boolean;
  jsonData?: unknown;
  jsonRejects?: boolean;
} = {}) {
  return {
    ok,
    json: jsonRejects
      ? vi.fn().mockRejectedValue(new SyntaxError("invalid json"))
      : vi.fn().mockResolvedValue(jsonData),
  };
}

describe("connectionsApi", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_API_BASE_URL", "");
  });

  it("carrega conexões usando URL base normalizada", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com///");
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        jsonData: {
          hasPassword: true,
          connections: [
            {
              provider: "github",
              connected: true,
              connectedAt: "2026-07-01T12:00:00.000Z",
            },
          ],
        },
      }),
    );

    await expect(getConnections()).resolves.toEqual({
      hasPassword: true,
      connections: [
        {
          provider: "github",
          connected: true,
          connectedAt: "2026-07-01T12:00:00.000Z",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/auth/connections",
      { credentials: "include" },
    );
  });

  it("lança erro ao falhar no carregamento das conexões", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false }));

    await expect(getConnections()).rejects.toThrow(
      "Falha ao carregar conexões.",
    );
    expect(fetchMock).toHaveBeenCalledWith("/auth/connections", {
      credentials: "include",
    });
  });

  it("desconecta provider e usa mensagem do backend quando disponível", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse());
    await expect(disconnectProvider("google")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/auth/connections/google", {
      method: "DELETE",
      credentials: "include",
    });

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        jsonData: { message: "Conexão principal não pode ser removida." },
      }),
    );

    await expect(disconnectProvider("linkedin")).rejects.toThrow(
      "Conexão principal não pode ser removida.",
    );
  });

  it("usa mensagem padrão quando erro de desconexão não tem JSON válido", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        jsonRejects: true,
      }),
    );

    await expect(disconnectProvider("github")).rejects.toThrow(
      "Falha ao desconectar.",
    );
  });

  it("inicia conexão OAuth redirecionando para a URL recebida", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/" },
    });

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        jsonData: { url: "https://github.com/login/oauth/authorize" },
      }),
    );

    await connectProvider("github");

    expect(fetchMock).toHaveBeenCalledWith("/auth/github/url?intent=link", {
      credentials: "include",
    });
    expect(window.location.href).toBe(
      "https://github.com/login/oauth/authorize",
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("lança erro quando não consegue iniciar conexão OAuth", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false }));

    await expect(connectProvider("google")).rejects.toThrow(
      "Falha ao iniciar conexão.",
    );
  });
});
