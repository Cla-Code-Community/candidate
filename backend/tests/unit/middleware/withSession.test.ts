import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetIronSession = vi.hoisted(() => vi.fn());

vi.mock("iron-session", () => ({
  getIronSession: mockGetIronSession,
}));

import { withSession } from "../../../src/middleware/withSession";

describe("withSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("injeta req.session e chama next", async () => {
    const session = {
      userId: "user-1",
      save: vi.fn(),
      destroy: vi.fn(),
    };
    mockGetIronSession.mockResolvedValue(session);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await withSession(req, res, next);

    expect(mockGetIronSession).toHaveBeenCalledOnce();
    expect(req.session).toBe(session);
    expect(next).toHaveBeenCalledOnce();
  });

  it("propaga erro quando getIronSession falha", async () => {
    const error = new Error("session failure");
    mockGetIronSession.mockRejectedValue(error);

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await expect(withSession(req, res, next)).rejects.toThrow("session failure");
    expect(next).not.toHaveBeenCalled();
  });
});
