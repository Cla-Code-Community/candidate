import { describe, expect, it, vi } from "vitest";
import {
  JobSearchCache,
  type SearchCacheStore,
} from "../../../../src/modules/jobs/cache/jobSearchCache";
import { parseJobSearchQuery } from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";
const filters = parseJobSearchQuery({ family: "product" });
const pagination = { page: 1, limit: 20 };
const page = { total: 1, jobs: [{ id: "product-1" }] };
function store() {
  return {
    generation: vi.fn().mockResolvedValue("1"),
    read: vi.fn().mockResolvedValue(null),
    writeIfGeneration: vi.fn().mockResolvedValue(true),
  } satisfies SearchCacheStore;
}
describe("generation-aware search cache", () => {
  it("uses a hit without querying and isolates mutable results", async () => {
    const storage = store();
    storage.read.mockResolvedValue(page);
    const cache = new JobSearchCache(storage);
    const query = vi.fn();
    const result = await cache.search(filters, pagination, null, query);
    result.jobs.pop();
    expect(page.jobs).toHaveLength(1);
    expect(query).not.toHaveBeenCalled();
  });
  it("publishes misses with a configurable TTL and observed generation", async () => {
    const storage = store();
    const query = vi.fn().mockResolvedValue(page);
    await new JobSearchCache(storage, 300).search(
      filters,
      pagination,
      null,
      query,
    );
    expect(storage.writeIfGeneration).toHaveBeenCalledWith(
      expect.stringMatching(/^jobs:search:v2:/),
      page,
      "1",
      300,
    );
    expect(query).toHaveBeenCalledOnce();
  });
  it("does not serve an old generation during invalidation", async () => {
    const storage = store();
    storage.read.mockResolvedValueOnce(page).mockResolvedValue(null);
    storage.generation.mockResolvedValue("2").mockResolvedValueOnce("1");
    const query = vi.fn().mockResolvedValue({ total: 0, jobs: [] });
    expect(
      await new JobSearchCache(storage).search(
        filters,
        pagination,
        null,
        query,
      ),
    ).toEqual({ total: 0, jobs: [] });
    expect(query).toHaveBeenCalledOnce();
  });
  it("returns controlled unavailability while indexes are unavailable", async () => {
    const storage = store();
    storage.generation.mockResolvedValue(null);
    const query = vi.fn().mockResolvedValue(page);
    await expect(new JobSearchCache(storage).search(filters, pagination, null, query)).rejects.toMatchObject({
      code: "SEARCH_CATALOG_UNAVAILABLE", statusCode: 503, details: { reason: "catalog_unavailable" },
    });
    expect(query).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
    expect(storage.writeIfGeneration).not.toHaveBeenCalled();
  });
  it("combines simultaneous queries and never retains failures", async () => {
    const storage = store();
    const cache = new JobSearchCache(storage);
    let resolve: (value: typeof page) => void = () => {};
    const query = vi.fn(
      () =>
        new Promise<typeof page>((done) => {
          resolve = done;
        }),
    );
    const first = cache.search(filters, pagination, null, query);
    const second = cache.search(filters, pagination, null, query);
    await vi.waitFor(() => expect(query).toHaveBeenCalledOnce());
    resolve(page);
    expect(await first).toEqual(await second);
    const failing = vi
      .fn()
      .mockRejectedValueOnce(new Error("query failed"))
      .mockResolvedValueOnce(page);
    await expect(
      cache.search(filters, pagination, null, failing),
    ).rejects.toThrow("query failed");
    await expect(
      cache.search(filters, pagination, null, failing),
    ).resolves.toEqual(page);
  });
  it("discards a build raced by a new generation and shares one reconstruction", async () => {
    const storage = store();
    let generation = "1";
    storage.generation.mockImplementation(async () => generation);
    const fresh = { total: 42, jobs: [{ id: "fresh", matchScore: 98 }] };
    const query = vi.fn().mockImplementationOnce(async () => { generation = "2"; return page; }).mockResolvedValue(fresh);
    const cache = new JobSearchCache(storage);
    const results = await Promise.all([
      cache.search(filters, pagination, { userId: "one" }, query),
      cache.search(filters, pagination, { userId: "one" }, query),
    ]);
    expect(results).toEqual([fresh, fresh]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(storage.writeIfGeneration).toHaveBeenCalledExactlyOnceWith(expect.any(String), fresh, "2", 120);
    results[0].jobs.pop();
    expect(results[1].jobs).toHaveLength(1);
  });

  it.each([true, false])("revalidates after publication returning %s", async (published) => {
    const storage = store();
    let generation = "1";
    storage.generation.mockImplementation(async () => generation);
    storage.writeIfGeneration.mockImplementationOnce(async () => { generation = "2"; return published; });
    const fresh = { total: 0, jobs: [] };
    const query = vi.fn().mockResolvedValueOnce(page).mockResolvedValue(fresh);
    await expect(new JobSearchCache(storage).search(filters, pagination, null, query)).resolves.toEqual(fresh);
    expect(query).toHaveBeenCalledTimes(2);
    expect(storage.writeIfGeneration).toHaveBeenLastCalledWith(expect.any(String), fresh, "2", 120);
  });

  it("stops after two raced builds and releases single-flight state", async () => {
    const storage = store();
    let generation = 1;
    storage.generation.mockImplementation(async () => String(generation));
    const query = vi.fn().mockImplementation(async () => { generation++; return page; });
    const cache = new JobSearchCache(storage);
    await expect(cache.search(filters, pagination, null, query)).rejects.toMatchObject({
      code: "SEARCH_CATALOG_UNAVAILABLE", statusCode: 503, details: { reason: "generation_changed" },
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(storage.writeIfGeneration).not.toHaveBeenCalled();
    query.mockResolvedValue(page);
    await expect(cache.search(filters, pagination, null, query)).resolves.toEqual(page);
  });

  it.each(["unavailable", "read_failed"])("does not return a page when the final fence is %s", async (reason) => {
    const storage = store();
    storage.generation.mockResolvedValueOnce("1").mockResolvedValueOnce("1").mockResolvedValueOnce("1");
    if (reason === "unavailable") storage.generation.mockResolvedValue(null);
    else storage.generation.mockRejectedValue(new Error("read failed"));
    await expect(new JobSearchCache(storage).search(filters, pagination, null, async () => page)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("rejects repeated publication fencing failures without unlimited retries", async () => {
    const storage = store();
    storage.writeIfGeneration.mockResolvedValue(false);
    const query = vi.fn().mockResolvedValue(page);
    await expect(new JobSearchCache(storage).search(filters, pagination, null, query)).rejects.toMatchObject({
      statusCode: 503, details: { reason: "publication_rejected" },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("keeps filters, page, ordering and personalized contexts isolated", async () => {
    const storage = store();
    const cache = new JobSearchCache(storage);
    const combined = parseJobSearchQuery({ family: "backend", technology: "go", type: "remoto", contract: "pj", matchSort: "desc" });
    const selected = { page: 2, limit: 2 };
    const ranked = { total: 9, jobs: [{ id: "a", matchScore: 90 }, { id: "b", matchScore: 80 }] };
    const query = vi.fn().mockResolvedValue(ranked);
    await Promise.all([
      cache.search(combined, selected, { userId: "one" }, query),
      cache.search(combined, selected, { userId: "two" }, query),
      cache.search(combined, { page: 1, limit: 2 }, { userId: "one" }, query),
      cache.search({ ...combined, matchSort: "asc" }, selected, { userId: "one" }, query),
    ]).then(results => expect(results).toEqual([ranked, ranked, ranked, ranked]));
    expect(query).toHaveBeenCalledTimes(4);
    expect(new Set(storage.writeIfGeneration.mock.calls.map(([key]) => key)).size).toBe(4);
  });
  it("tolerates cache read/write outages without hiding query failures", async () => {
    const storage = store();
    storage.read.mockRejectedValue(new Error("cache down"));
    storage.writeIfGeneration.mockRejectedValue(new Error("cache down"));
    await expect(
      new JobSearchCache(storage).search(
        filters,
        pagination,
        null,
        async () => page,
      ),
    ).resolves.toEqual(page);
    storage.generation.mockRejectedValue(new Error("cache down"));
    await expect(
      new JobSearchCache(storage).search(
        filters,
        pagination,
        null,
        async () => page,
      ),
    ).rejects.toMatchObject({ statusCode: 503, details: { reason: "generation_read_failed" } });
  });
  it.each([0, -1, 1.5, 86401, NaN])("rejects invalid TTL %s", (ttl) => {
    expect(() => new JobSearchCache(store(), ttl)).toThrow(
      "JOB_SEARCH_CACHE_TTL_SECONDS",
    );
  });
});
