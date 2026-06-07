import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../../src/middleware/errorHandler";

describe("errorHandler", () => {
  it("deve retornar 403 para erro de CORS", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const res = {
      status,
    };

    errorHandler(
      new Error("Origin not allowed by CORS"),
      {} as any,
      res as any,
      vi.fn(),
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message: "Origem não permitida.",
    });
  });

  it("deve retornar 500 para erros genéricos", () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const res = {
      status,
    };

    errorHandler(
      new Error("Erro qualquer"),
      {} as any,
      res as any,
      vi.fn(),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      message: "Erro interno.",
      error: "Erro qualquer",
    });
  });
});