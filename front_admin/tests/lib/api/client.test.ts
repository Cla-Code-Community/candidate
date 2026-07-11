import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../../src/lib/api/client";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("sends json requests with credentials", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await expect(api.post("/login", { email: "a@b.com" })).resolves.toEqual({
      ok: true,
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "a@b.com" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("returns undefined for 204 responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(api.delete("/session")).resolves.toBeUndefined();
  });

  it("omits body for post requests without data and keeps custom headers", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await api.get("/custom", { headers: { "X-Test": "1" } });

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/custom",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Test": "1",
        }),
      }),
    );

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await api.post("/empty");

    expect(fetch).toHaveBeenLastCalledWith(
      "http://localhost:3001/empty",
      expect.objectContaining({ body: undefined }),
    );
  });

  it("throws ApiError with parsed response body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "nope" }), { status: 401 }),
    );

    await expect(api.get("/private")).rejects.toMatchObject({
      status: 401,
      body: { message: "nope" },
    });
  });

  it("throws ApiError with null body when error response is not json", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("plain", { status: 500 }),
    );

    await expect(api.get("/broken")).rejects.toMatchObject({
      status: 500,
      body: null,
    });
  });

  it("accepts configured non-ok statuses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "down" }), { status: 503 }),
    );

    await expect(
      api.get("/health", { acceptedStatuses: [503] }),
    ).resolves.toEqual({ status: "down" });
  });

  it("exposes status and body on ApiError instances", () => {
    const error = new ApiError(500, { trace: "abc" });

    expect(error.message).toBe("API error 500");
    expect(error.status).toBe(500);
    expect(error.body).toEqual({ trace: "abc" });
  });
});
