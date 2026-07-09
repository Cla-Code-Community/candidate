const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

type ApiRequestOptions = RequestInit & {
  acceptedStatuses?: number[];
};

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { acceptedStatuses = [], ...requestOptions } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    credentials: "include", // essencial pro cookie do iron-session ir junto
    headers: {
      "Content-Type": "application/json",
      ...requestOptions.headers,
    },
  });

  if (!res.ok && !acceptedStatuses.includes(res.status)) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    request<T>(path, options),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: "DELETE",
    }),
};

export { ApiError };
