import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "../../../src/lib/errors";
import { validate } from "../../../src/middleware/validate";

describe("validate middleware", () => {
  it("substitui body pelo valor parseado e chama next", () => {
    const schema = z.object({
      email: z.string().email(),
    });
    const middleware = validate({ body: schema });
    const req = { body: { email: "a@b.com", extra: true } } as any;
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(req.body).toEqual({ email: "a@b.com" });
    expect(next).toHaveBeenCalledWith();
  });

  it("encaminha AppError.fromZodError quando body é inválido", () => {
    const schema = z.object({
      email: z.string().email(),
    });
    const middleware = validate({ body: schema });
    const req = { body: { email: "x" } } as any;
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.details).toHaveProperty("email");
  });

  it("valida query e params", () => {
    const middleware = validate({
      query: z.object({ page: z.coerce.number().int() }),
      params: z.object({ id: z.string().min(1) }),
    });
    const id = "job-1";
    const req = {
      query: { page: "2" },
      params: { id },
    } as any;
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(req.query).toEqual({ page: 2 });
    expect(req.params).toEqual({ id });
    expect(next).toHaveBeenCalledWith();
  });
});
