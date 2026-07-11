import { describe, expect, it } from "vitest";
import { ApiError, parseApiError } from "@/shared/lib/apiError";

describe("parseApiError", () => {
  it("lê o envelope padronizado code/message/details", () => {
    const error = parseApiError(
      {
        code: "VALIDATION_ERROR",
        message: "Dados inválidos",
        details: { email: ["Invalid email"] },
      },
      400,
      "fallback",
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Dados inválidos");
    expect(error.status).toBe(400);
    expect(error.details).toEqual({ email: ["Invalid email"] });
  });

  it("tolera payload legado com error string", () => {
    const error = parseApiError({ error: "Email já cadastrado" }, 409, "fallback");
    expect(error.message).toBe("Email já cadastrado");
    expect(error.code).toBe("CONFLICT");
  });

  it("usa fallback quando payload está vazio", () => {
    const error = parseApiError({}, 500, "Falha ao fazer login.");
    expect(error.message).toBe("Falha ao fazer login.");
    expect(error.code).toBe("INTERNAL_ERROR");
  });
});
