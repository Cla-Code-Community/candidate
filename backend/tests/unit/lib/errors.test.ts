import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../../../src/lib/errors";

describe("AppError", () => {
  it("cria VALIDATION_ERROR com details", () => {
    const error = AppError.validation("Dados inválidos", {
      email: ["Invalid email"],
    });

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe("Dados inválidos");
    expect(error.toJSON()).toEqual({
      code: "VALIDATION_ERROR",
      message: "Dados inválidos",
      details: { email: ["Invalid email"] },
    });
  });

  it("omite details quando ausente", () => {
    const error = AppError.unauthorized();
    expect(error.toJSON()).toEqual({
      code: "UNAUTHORIZED",
      message: "Não autenticado.",
    });
  });

  it("mapeia factories para status corretos", () => {
    expect(AppError.forbidden().statusCode).toBe(403);
    expect(AppError.notFound().statusCode).toBe(404);
    expect(AppError.conflict("dup").statusCode).toBe(409);
    expect(AppError.internal().statusCode).toBe(500);
  });

  it("fromZodError usa fieldErrors", () => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse({ email: "x" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const error = AppError.fromZodError(parsed.error);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toHaveProperty("email");
  });
});
