import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/apiError";

const axiosMock = vi.hoisted(() => {
  let fulfilledHandler: ((value: unknown) => unknown) | undefined;
  let rejectedHandler: ((value: unknown) => Promise<never>) | undefined;

  return {
    create: vi.fn(() => ({
      interceptors: {
        response: {
          use: vi.fn((fulfilled, rejected) => {
            fulfilledHandler = fulfilled;
            rejectedHandler = rejected;
          }),
        },
      },
    })),
    isAxiosError: vi.fn((error: { isAxiosError?: boolean } | undefined) =>
      Boolean(error?.isAxiosError),
    ),
    getFulfilledHandler: () => fulfilledHandler,
    getRejectedHandler: () => rejectedHandler,
  };
});

vi.mock("axios", () => ({
  default: {
    create: axiosMock.create,
    isAxiosError: axiosMock.isAxiosError,
  },
}));

import { api } from "@/shared/lib/apiClient";

describe("apiClient", () => {
  beforeEach(() => {
    axiosMock.isAxiosError.mockClear();
  });

  it("exporta a instância criada e passa respostas não-axios sem transformação", async () => {
    expect(api).toBeTruthy();

    const rejected = axiosMock.getRejectedHandler();
    expect(rejected).toBeDefined();

    await expect(
      rejected!({ message: "erro simples" }),
    ).rejects.toEqual({ message: "erro simples" });
    expect(axiosMock.isAxiosError).toHaveBeenCalledWith({
      message: "erro simples",
    });
  });

  it("converte erro axios em ApiError padronizado", async () => {
    const rejected = axiosMock.getRejectedHandler();
    expect(rejected).toBeDefined();

    await expect(
      rejected!({
        isAxiosError: true,
        message: "Request failed",
        response: {
          status: 404,
          data: {
            code: "NOT_FOUND",
            message: "Não encontrado",
          },
        },
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "NOT_FOUND",
      status: 404,
      message: "Não encontrado",
    });

    await expect(
      rejected!({
        isAxiosError: true,
        message: "Request failed",
        response: {
          status: 500,
          data: { message: "Falha interna" },
        },
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      rejected!({
        isAxiosError: true,
        message: "Sem response",
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: "INTERNAL_ERROR",
    });

    await expect(
      rejected!({
        isAxiosError: true,
        message: "",
        response: {
          data: {
            code: "BAD_GATEWAY",
            message: "",
          },
        },
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: "UNKNOWN_ERROR",
      message: "Erro na requisição.",
    });
  });
});
