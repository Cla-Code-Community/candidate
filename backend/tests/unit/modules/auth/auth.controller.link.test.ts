// backend/tests/unit/modules/auth/auth.controller.link.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/lib/errors";

const mocks = vi.hoisted(() => ({
  linkProviderToUser: vi.fn(),
  getProfileFromProvider: vi.fn(),
  handleCallback: vi.fn(),
}));

vi.mock("../../../../src/modules/users/functions/linkProviderToUser", () => ({
  linkProviderToUser: mocks.linkProviderToUser,
}));

import { AuthController } from "../../../../src/modules/auth/auth.controller";

function fakeRes() {
  return {
    redirect: vi.fn(),
    json: vi.fn(),
    status: vi.fn().mockReturnThis(),
  } as any;
}

function fakeService() {
  return {
    getProfileFromProvider: mocks.getProfileFromProvider,
    handleCallback: mocks.handleCallback,
    getAuthUrl: vi.fn(),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FRONTEND_URL = "http://localhost:5173";
  process.env.APP_URL = "http://localhost:3001";
});

describe("AuthController callback — modo vínculo", () => {
  it("vincula e redireciona para /perfil/conexoes?linked= sem trocar sessão", async () => {
    mocks.getProfileFromProvider.mockResolvedValue({ id: "prov-1" });
    mocks.linkProviderToUser.mockResolvedValue(undefined);

    const controller = new AuthController(fakeService());
    const save = vi.fn();
    const req = {
      params: { provider: "google" },
      query: { code: "c", state: "s" },
      session: {
        userId: "user-A",
        role: "user",
        oauth_state: "s",
        oauth_intent: "link",
        save,
      },
    } as any;
    const res = fakeRes();

    await controller.callback(req, res);

    expect(mocks.linkProviderToUser).toHaveBeenCalledWith({
      userId: "user-A",
      provider: "google",
      profile: { id: "prov-1" },
    });
    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/perfil/conexoes?linked=google",
    );
    expect(mocks.handleCallback).not.toHaveBeenCalled();
  });

  it("redireciona com erro quando o provider já está vinculado", async () => {
    mocks.getProfileFromProvider.mockResolvedValue({ id: "prov-1" });
    mocks.linkProviderToUser.mockRejectedValue(
      AppError.conflict("já vinculado"),
    );

    const controller = new AuthController(fakeService());
    const req = {
      params: { provider: "google" },
      query: { code: "c", state: "s" },
      session: {
        userId: "user-A",
        role: "user",
        oauth_state: "s",
        oauth_intent: "link",
        save: vi.fn(),
      },
    } as any;
    const res = fakeRes();

    await controller.callback(req, res);

    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:5173/perfil/conexoes?error=provider_already_linked",
    );
  });
});
