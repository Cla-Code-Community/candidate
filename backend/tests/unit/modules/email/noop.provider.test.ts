import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerMocks = vi.hoisted(() => ({
  logWarn: vi.fn(),
}));

vi.mock("../../../../src/logger", () => ({
  logWarn: loggerMocks.logWarn,
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

import { NoopProvider } from "../../../../src/modules/email/providers/noop.provider";

describe("NoopProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loga aviso e resolve sem lançar (EMAIL-09)", async () => {
    const provider = new NoopProvider();

    await expect(
      provider.send({
        to: "user@example.com",
        subject: "Assunto",
        html: "<p>oi</p>",
      }),
    ).resolves.toBeUndefined();

    expect(loggerMocks.logWarn).toHaveBeenCalledOnce();
    const [, ctx] = loggerMocks.logWarn.mock.calls[0];
    expect(ctx).toMatchObject({ to: "user@example.com" });
  });
});
