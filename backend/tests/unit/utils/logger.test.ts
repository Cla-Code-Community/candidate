import { describe, expect, it, vi } from "vitest";

describe("logger", () => {
  it("logInfo writes to stdout with info level", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const { logInfo } = await import("../../../src/logger.ts");
    logInfo("test info message", { userId: "123" });

    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("test info message");
    expect(parsed.userId).toBe("123");

    spy.mockRestore();
  });

  it("logWarn writes to stdout with warn level", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const { logWarn } = await import("../../../src/logger.ts");
    logWarn("test warn");

    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe("warn");
    expect(parsed.msg).toBe("test warn");

    spy.mockRestore();
  });

  it("logError writes to stdout with error level", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const { logError } = await import("../../../src/logger.ts");
    logError("test error", { error: "timeout" });

    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("test error");
    expect(parsed.error).toBe("timeout");

    spy.mockRestore();
  });

  it("uses LOG_LEVEL from environment", async () => {
    process.env.LOG_LEVEL = "warn";
    vi.resetModules();

    const { logger } = await import("../../../src/logger.ts");
    expect(logger.level).toBe("warn");

    delete process.env.LOG_LEVEL;
    vi.resetModules();
  });

  it("logInfo works without ctx", async () => {
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);

    const { logInfo } = await import("../../../src/logger.ts");
    logInfo("no context");

    const output = spy.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output);

    expect(parsed.msg).toBe("no context");

    spy.mockRestore();
  });

  it("defaults to info level", async () => {
    delete process.env.LOG_LEVEL;
    vi.resetModules();

    const { logger } = await import("../../../src/logger.ts");
    expect(logger.level).toBe("info");

    vi.resetModules();
  });
});
