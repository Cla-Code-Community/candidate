import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../../../src/middleware/requireAuth";

describe("requireAuth", () => {
  it("responde UNAUTHORIZED quando não há sessão", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const next = vi.fn();

    requireAuth({ session: {} } as any, { status } as any, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next quando autenticado", () => {
    const next = vi.fn();
    requireAuth(
      { session: { userId: "u1" } } as any,
      { status: vi.fn() } as any,
      next,
    );
    expect(next).toHaveBeenCalled();
  });
});
