import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

// Providers concretos mockados (definidos em vi.hoisted para poder ser
// referenciados dentro das factories de vi.mock, que são içadas ao topo).
const providerMocks = vi.hoisted(() => ({
  FakeResend: class FakeResend {},
  FakeNoop: class FakeNoop {},
}));
const { FakeResend, FakeNoop } = providerMocks;

vi.mock("../../../../src/config", () => ({
  getConfig: configMocks.getConfig,
}));

vi.mock("../../../../src/modules/email/providers/resend.provider", () => ({
  ResendProvider: providerMocks.FakeResend,
}));

vi.mock("../../../../src/modules/email/providers/noop.provider", () => ({
  NoopProvider: providerMocks.FakeNoop,
}));

import { getMailProvider } from "../../../../src/modules/email/providers/mail-provider";

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    emailApiKey: "",
    emailFromAddress: "no-reply@example.com",
    emailFromName: "Painel Vagas",
    ...overrides,
  };
}

describe("getMailProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna NoopProvider quando emailApiKey está vazio (EMAIL-09)", () => {
    configMocks.getConfig.mockReturnValue(baseConfig({ emailApiKey: "" }));

    const provider = getMailProvider();

    expect(provider).toBeInstanceOf(FakeNoop);
  });

  it("retorna ResendProvider quando emailApiKey está presente (EMAIL-04)", () => {
    configMocks.getConfig.mockReturnValue(
      baseConfig({ emailApiKey: "re_abc123" }),
    );

    const provider = getMailProvider();

    expect(provider).toBeInstanceOf(FakeResend);
  });
});
