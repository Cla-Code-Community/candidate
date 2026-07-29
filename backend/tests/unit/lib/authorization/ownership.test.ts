import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: mocks.eq,
  };
});

import {
  assertOwnsResource,
  ownedBy,
} from "../../../../src/lib/authorization/ownership";

describe("ownership authorization helpers", () => {
  it("permite recurso do usuário autenticado", () => {
    expect(() => {
      assertOwnsResource("user-1", "user-1", "Vaga");
    }).not.toThrow();
  });

  it("retorna 404 quando o recurso pertence a outro usuário", () => {
    expect(() => {
      assertOwnsResource("user-1", "user-2", "Vaga não encontrada");
    }).toThrow(expect.objectContaining({
      code: "NOT_FOUND",
      statusCode: 404,
      message: "Vaga não encontrada",
    }));
  });

  it("cria filtro Drizzle para userId", () => {
    mocks.eq.mockReturnValue("owned-by-user-1");

    expect(ownedBy("user-1", "user_id" as any)).toBe("owned-by-user-1");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
