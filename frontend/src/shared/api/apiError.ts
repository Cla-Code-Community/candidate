export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "UNKNOWN_ERROR";

export type ApiErrorDetails = Record<string, unknown>;

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: ApiErrorDetails;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetails;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details?: ApiErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asCode(value: unknown): ApiErrorCode | undefined {
  const code = asString(value);
  if (!code) return undefined;

  const known: ApiErrorCode[] = [
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "INTERNAL_ERROR",
    "UNKNOWN_ERROR",
  ];

  return known.includes(code as ApiErrorCode)
    ? (code as ApiErrorCode)
    : "UNKNOWN_ERROR";
}

function codeFromStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 500:
      return "INTERNAL_ERROR";
    default:
      return "UNKNOWN_ERROR";
  }
}

/**
 * Parses the standardized API error envelope `{ code, message, details? }`.
 * Also tolerates legacy shapes (`error` string / object, `message` only).
 */
export function parseApiError(
  payload: unknown,
  status: number,
  fallback: string,
): ApiError {
  if (!isRecord(payload)) {
    return new ApiError(codeFromStatus(status), fallback, status);
  }

  const code =
    asCode(payload.code) ??
    (isRecord(payload.error) ? asCode(payload.error.code) : undefined) ??
    codeFromStatus(status);

  const message =
    asString(payload.message) ??
    asString(payload.error) ??
    (isRecord(payload.error) ? asString(payload.error.message) : undefined) ??
    fallback;

  const detailsCandidate =
    payload.details ??
    (isRecord(payload.error) ? payload.error.details : undefined);

  const details = isRecord(detailsCandidate) ? detailsCandidate : undefined;

  return new ApiError(code, message, status, details);
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
