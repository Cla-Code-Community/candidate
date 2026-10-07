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
    storage.read.mockResolvedValue(page);
    storage.generation.mockResolvedValueOnce("1").mockResolvedValueOnce("2");
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
  it("bypasses cache while indexes are unavailable", async () => {
    const storage = store();
    storage.generation.mockResolvedValue(null);
    const query = vi.fn().mockResolvedValue(page);
    await new JobSearchCache(storage).search(filters, pagination, null, query);
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
    ).resolves.toEqual(page);
  });
  it.each([0, -1, 1.5, 86401, NaN])("rejects invalid TTL %s", (ttl) => {
    expect(() => new JobSearchCache(store(), ttl)).toThrow(
      "JOB_SEARCH_CACHE_TTL_SECONDS",
    );
  });
});
