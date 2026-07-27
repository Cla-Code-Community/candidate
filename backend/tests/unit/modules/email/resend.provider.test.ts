import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

const resendMocks = vi.hoisted(() => ({
  send: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock("../../../../src/config", () => ({
  getConfig: configMocks.getConfig,
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendMocks.send };
    constructor(apiKey: string) {
      resendMocks.constructor(apiKey);
    }
  },
}));

vi.mock("../../../../src/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

import { ResendProvider } from "../../../../src/modules/email/providers/resend.provider";

describe("ResendProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMocks.getConfig.mockReturnValue({
      emailApiKey: "re_abc123",
      emailFromAddress: "no-reply@painelvagas.com",
      emailFromName: "Painel Vagas",
    });
  });

  it("chama o SDK com from formatado e campos mapeados (EMAIL-02/04)", async () => {
    resendMocks.send.mockResolvedValue({ data: { id: "eml_1" }, error: null });
    const provider = new ResendProvider();

    await provider.send({
      to: "user@example.com",
      subject: "Bem-vindo",
      html: "<p>Olá</p>",
      replyTo: "suporte@painelvagas.com",
    });

    expect(resendMocks.constructor).toHaveBeenCalledWith("re_abc123");
    expect(resendMocks.send).toHaveBeenCalledWith({
      from: "Painel Vagas <no-reply@painelvagas.com>",
      to: "user@example.com",
      subject: "Bem-vindo",
      html: "<p>Olá</p>",
      replyTo: "suporte@painelvagas.com",
    });
  });

  it("propaga (lança) quando o SDK retorna erro para permitir retry (EMAIL-03)", async () => {
    resendMocks.send.mockResolvedValue({
      data: null,
      error: { message: "rate limit", name: "rate_limit_exceeded" },
    });
    const provider = new ResendProvider();

    await expect(
      provider.send({
        to: "user@example.com",
        subject: "Bem-vindo",
        html: "<p>Olá</p>",
      }),
    ).rejects.toThrow("rate limit");
  });
});
