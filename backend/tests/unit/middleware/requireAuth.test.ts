import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../../../src/middleware/requireAuth";

function makeMocks(session: Request["session"] | undefined) {
  const req = { session } as Request;
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as NextFunction;

  return { req, res, next, json, status };
}

describe("requireAuth", () => {
  it("retorna 401 quando sessão não tem userId", () => {
    const { req, res, next, status, json } = makeMocks({} as Request["session"]);

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("retorna 401 quando sessão é undefined", () => {
    const { req, res, next, status, json } = makeMocks(undefined);

    requireAuth(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("chama next quando userId está presente na sessão", () => {
    const { req, res, next, status } = makeMocks({
      userId: "user-1",
    } as Request["session"]);

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });
});
