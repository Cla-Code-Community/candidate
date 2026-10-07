import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { metricsMiddleware } from "../../../src/middleware/metrics";
import {
  register,
  httpRequestsTotal,
  searchCacheRequests,
  searchCacheDuration,
  searchCacheInvalidations,
} from "../../../src/metrics/metrics";
import { JobSearchCache } from "../../../src/modules/jobs/cache/jobSearchCache";
import { parseJobSearchQuery } from "../../../src/modules/jobs/parsers/jobSearchQuery.parser";

beforeEach(() => {
  httpRequestsTotal.reset();
  searchCacheRequests.reset();
  searchCacheDuration.reset();
  searchCacheInvalidations.reset();
});
describe("operational metrics cardinality and cache", () => {
  it("uses route templates and bounded unmatched/method labels", async () => {
    const app = express();
    app.use(metricsMiddleware);
    app.get("/users/:id", (_req, res) => res.json({ ok: true }));
    await request(app).get("/users/private-user-id?email=secret@example.com");
    await request(app).get("/arbitrary-secret-job-id?token=private");
    const values = (await httpRequestsTotal.get()).values;
    expect(values.map((v) => v.labels.route)).toEqual([
      "/users/:id",
      "__unmatched__",
    ]);
    const serialized = JSON.stringify(values);
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("secret");
  });
  it.each(["hit", "miss", "stale", "error"])(
    "records %s and get/set timing without key labels",
    async (result) => {
      const storage = {
        generation: vi.fn().mockResolvedValue("v1"),
        read: vi
          .fn()
          .mockResolvedValue(result === "hit" ? { jobs: [], total: 0 } : null),
        writeIfGeneration: vi.fn().mockResolvedValue(true),
      };
      if (result === "stale") storage.generation.mockResolvedValue(null);
      if (result === "error")
        storage.generation.mockRejectedValue(new Error("secret free error"));
      await new JobSearchCache(storage).search(
        parseJobSearchQuery({
          family: "product",
          keywords: "private free text",
        }),
        { page: 1, limit: 20 },
        null,
        async () => ({ jobs: [], total: 0 }),
      );
      expect((await searchCacheRequests.get()).values).toContainEqual(
        expect.objectContaining({ labels: { result }, value: 1 }),
      );
      expect((await searchCacheDuration.get()).values).toContainEqual(
        expect.objectContaining({
          metricName:
            "candidate_jobs_search_cache_operation_duration_seconds_count",
          labels: { operation: "get" },
          value: expect.any(Number),
        }),
      );
    },
  );
  it("rejects prohibited labels in the metrics registry", async () => {
    for (const metric of await register.getMetricsAsJSON()) {
      if (
        !metric.name.startsWith("candidate_") &&
        !metric.name.startsWith("http_")
      )
        continue;
      for (const value of metric.values) {
        for (const label of Object.keys(value.labels)) {
          expect([
            "result",
            "operation",
            "reason",
            "route",
            "method",
            "status_code",
            "le",
          ]).toContain(label);
        }
      }
    }
  });
});

it("counts a request once when a miss is followed by a cache write failure", async () => {
  const storage = {
    generation: vi.fn().mockResolvedValue("v1"),
    read: vi.fn().mockResolvedValue(null),
    writeIfGeneration: vi.fn().mockRejectedValue(new Error("write failed")),
  };
  await new JobSearchCache(storage).search(
    parseJobSearchQuery({ family: "product" }),
    { page: 1, limit: 20 },
    null,
    async () => ({ jobs: [], total: 0 }),
  );
  const values = (await searchCacheRequests.get()).values;
  expect(values).toEqual([
    expect.objectContaining({ labels: { result: "error" }, value: 1 }),
  ]);
  expect((await searchCacheDuration.get()).values).toContainEqual(
    expect.objectContaining({
      labels: { operation: "set" },
      metricName:
        "candidate_jobs_search_cache_operation_duration_seconds_count",
      value: 1,
    }),
  );
});

it("records a rejected generation publication as stale", async () => {
  const storage = {
    generation: vi.fn().mockResolvedValue("v1"),
    read: vi.fn().mockResolvedValue(null),
    writeIfGeneration: vi.fn().mockResolvedValue(false),
  };
  await new JobSearchCache(storage).search(
    parseJobSearchQuery({ family: "product" }),
    { page: 1, limit: 20 },
    null,
    async () => ({ jobs: [], total: 0 }),
  );
  expect((await searchCacheRequests.get()).values).toEqual([
    expect.objectContaining({ labels: { result: "stale" }, value: 1 }),
  ]);
});
