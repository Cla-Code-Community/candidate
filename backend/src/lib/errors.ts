import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: ErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static validation(
    message = "Dados inválidos",
    details?: ErrorDetails,
  ): AppError {
    return new AppError("VALIDATION_ERROR", message, 400, details);
  }

  static unauthorized(message = "Não autenticado."): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Acesso negado."): AppError {
    return new AppError("FORBIDDEN", message, 403);
  }

  static notFound(message = "Recurso não encontrado."): AppError {
    return new AppError("NOT_FOUND", message, 404);
  }

  static conflict(message: string, details?: ErrorDetails): AppError {
    return new AppError("CONFLICT", message, 409, details);
  }

  static internal(
    message = "Erro interno.",
    details?: ErrorDetails,
  ): AppError {
    return new AppError("INTERNAL_ERROR", message, 500, details);
  }

  static fromZodError(
    error: ZodError,
    message = "Dados inválidos",
  ): AppError {
    return AppError.validation(message, error.flatten().fieldErrors);
  }

  toJSON(): { code: ErrorCode; message: string; details?: ErrorDetails } {
    const body: { code: ErrorCode; message: string; details?: ErrorDetails } = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      body.details = this.details;
    }
    return body;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
