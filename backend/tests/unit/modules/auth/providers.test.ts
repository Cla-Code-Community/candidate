import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  discovery: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  credentialsFindFirst: vi.fn(),
  insertValues: vi.fn(),
  hash: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("openid-client", () => ({
  discovery: mocks.discovery,
  buildAuthorizationUrl: mocks.buildAuthorizationUrl,
  authorizationCodeGrant: mocks.authorizationCodeGrant,
}));

vi.mock("argon2", () => ({
  hash: mocks.hash,
  verify: mocks.verify,
}));

vi.mock("../../../../src/db/client.js", () => ({
  db: {
    query: {
      credentials: { findFirst: mocks.credentialsFindFirst },
    },
    insert: vi.fn(() => ({ values: mocks.insertValues })),
  },
}));

vi.mock("../../../../src/db/schema/credentials.js", () => ({
  credentials: {
    email: "email",
  },
}));

import {
  exchangeGithubCode,
  getGithubAuthUrl,
} from "../../../../src/modules/auth/providers/github";
import {
  exchangeGoogleCode,
  getGoogleAuthUrl,
} from "../../../../src/modules/auth/providers/google";
import {
  exchangeLinkedinCode,
  getLinkedinAuthUrl,
} from "../../../../src/modules/auth/providers/linkedin";
import {
  registerWithCredentials,
  verifyCredentials,
} from "../../../../src/modules/auth/providers/credentials";

describe("OAuth providers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_URL = "https://api.example.com";
    process.env.GITHUB_CLIENT_ID = "github-id";
    process.env.GITHUB_CLIENT_SECRET = "github-secret";
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    process.env.LINKEDIN_CLIENT_ID = "linkedin-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    vi.useRealTimers();
  });

  it("monta a URL de autorização do GitHub", async () => {
    const url = new URL(await getGithubAuthUrl("state-123"));

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("github-id");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/auth/github/callback",
    );
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toBe("state-123");
  });

  it("troca code do GitHub por perfil usando email primário verificado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ access_token: "gh-token" }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              id: 42,
              email: "fallback@example.com",
              name: null,
              login: "octocat",
              avatar_url: "https://avatar.test/octocat.png",
            }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve([
              { email: "private@example.com", primary: false, verified: true },
              { email: "primary@example.com", primary: true, verified: true },
            ]),
        }),
    );

    const profile = await exchangeGithubCode({ code: "code-123" });

    expect(profile).toMatchObject({
      id: "42",
      email: "primary@example.com",
      name: "octocat",
      username: "octocat",
      picture: "https://avatar.test/octocat.png",
      access_token: "gh-token",
    });
  });

  it("monta URL do Google via openid-client e troca callback por claims", async () => {
    const config = { issuer: "google" };
    mocks.discovery.mockResolvedValue(config);
    mocks.buildAuthorizationUrl.mockReturnValue(
      new URL("https://accounts.google.com/o/oauth2/v2/auth?state=state-123"),
    );
    mocks.authorizationCodeGrant.mockResolvedValue({
      access_token: "google-token",
      refresh_token: "google-refresh",
      claims: () => ({
        sub: "google-user",
        email: "g@example.com",
        name: "Google User",
        given_name: "Google",
        family_name: "User",
        picture: "https://avatar.test/google.png",
        exp: 1_700_000_000,
      }),
    });

    await expect(getGoogleAuthUrl("state-123")).resolves.toContain(
      "state=state-123",
    );
    const profile = await exchangeGoogleCode({
      callbackUrl: "https://api.example.com/auth/google/callback?code=abc",
      state: "state-123",
    });

    expect(mocks.discovery).toHaveBeenCalledWith(
      new URL("https://accounts.google.com"),
      "google-id",
      "google-secret",
    );
    expect(profile).toMatchObject({
      id: "google-user",
      email: "g@example.com",
      access_token: "google-token",
      refresh_token: "google-refresh",
      expires_at: 1_700_000_000,
    });
  });

  it("valida erros no callback do Google", async () => {
    await expect(
      exchangeGoogleCode({
        callbackUrl: "https://api.example.com/auth/google/callback?code=abc",
        state: undefined,
      }),
    ).rejects.toThrow("State ausente");

    mocks.authorizationCodeGrant.mockResolvedValue({
      claims: () => null,
    });

    await expect(
      exchangeGoogleCode({
        callbackUrl: "https://api.example.com/auth/google/callback?code=abc",
        state: "state-123",
      }),
    ).rejects.toThrow("Invalid Google claims");
  });

  it("monta URL e troca code do LinkedIn por perfil", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "linkedin-token",
              refresh_token: "linkedin-refresh",
              expires_in: 3600,
            }),
        })
        .mockResolvedValueOnce({
          json: () =>
            Promise.resolve({
              sub: "linkedin-user",
              email: "l@example.com",
              name: "LinkedIn User",
              given_name: "LinkedIn",
              family_name: "User",
              picture: "https://avatar.test/linkedin.png",
            }),
        }),
    );

    const authUrl = new URL(await getLinkedinAuthUrl("state-123"));
    expect(authUrl.searchParams.get("client_id")).toBe("linkedin-id");
    expect(authUrl.searchParams.get("scope")).toBe("openid profile email");

    const profile = await exchangeLinkedinCode({ code: "code-123" });

    expect(profile).toMatchObject({
      id: "linkedin-user",
      email: "l@example.com",
      access_token: "linkedin-token",
      refresh_token: "linkedin-refresh",
      expires_at: 1_767_229_200,
    });
  });

  it("propaga erro de token do LinkedIn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error_description: "invalid code" }),
      }),
    );

    await expect(exchangeLinkedinCode({ code: "bad-code" })).rejects.toThrow(
      "invalid code",
    );
  });
});

describe("credentials provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credentialsFindFirst.mockResolvedValue(null);
    mocks.hash.mockResolvedValue("hash-value");
    mocks.verify.mockResolvedValue(true);
  });

  it("registra credencial quando email ainda não existe", async () => {
    await registerWithCredentials("user@example.com", "Senha@123");

    expect(mocks.hash).toHaveBeenCalledWith("Senha@123");
    expect(mocks.insertValues).toHaveBeenCalledWith({
      email: expect.stringMatching(/^v1:/),
      emailHash: expect.any(String),
      passwordHash: "hash-value",
      userId: "",
    });
    expect(mocks.insertValues.mock.calls[0][0].email).not.toBe(
      "user@example.com",
    );
  });

  it("impede registro duplicado", async () => {
    mocks.credentialsFindFirst.mockResolvedValue({ id: "cred-1" });

    await expect(
      registerWithCredentials("user@example.com", "Senha@123"),
    ).rejects.toThrow("Email já cadastrado");
    expect(mocks.hash).not.toHaveBeenCalled();
  });

  it("verifica credenciais válidas", async () => {
    mocks.credentialsFindFirst.mockResolvedValue({
      userId: "user-1",
      passwordHash: "stored-hash",
    });

    await expect(
      verifyCredentials("user@example.com", "Senha@123"),
    ).resolves.toEqual({ userId: "user-1" });
    expect(mocks.verify).toHaveBeenCalledWith("stored-hash", "Senha@123");
  });

  it("rejeita credenciais inexistentes ou senha inválida", async () => {
    await expect(
      verifyCredentials("missing@example.com", "Senha@123"),
    ).rejects.toThrow("Credenciais inválidas");

    mocks.credentialsFindFirst.mockResolvedValue({
      userId: "user-1",
      passwordHash: "stored-hash",
    });
    mocks.verify.mockResolvedValue(false);

    await expect(
      verifyCredentials("user@example.com", "Senha@123"),
    ).rejects.toThrow("Credenciais inválidas");
  });
});
