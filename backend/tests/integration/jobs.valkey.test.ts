import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createClient } from "redis";
const mocks = vi.hoisted(() => ({ getCache: vi.fn() }));
vi.mock("../../src/lib/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/cache")>()),
  getCache: mocks.getCache,
}));
import { JobSearchRepository } from "../../src/modules/jobs/repositories/jobSearch.repository";
import { parseJobSearchQuery } from "../../src/modules/jobs/parsers/jobSearchQuery.parser";
import { ValkeySearchCacheStore } from "../../src/modules/jobs/cache/valkeySearchCache.adapter";
import { JobSearchCache } from "../../src/modules/jobs/cache/jobSearchCache";
import { jobSearchCacheKey } from "../../src/modules/jobs/cache/jobSearchFingerprint";
import { openIndexedSearch } from "../../src/modules/jobs/repositories/valkeyJobSearch.adapter";

// Explicit opt-in, dedicated disposable instance only. Never erase a database.
const url = process.env.PAV125_TEST_VALKEY_URL;
describe.skipIf(!url)("PAV-125 real Valkey search and cache", () => {
  const client = createClient({ url });
  const version = `v2-test-${process.pid}`;
  const prefix = `scraper:jobs:ns:${version}:`;
  const owned = new Set<string>();
  const jobs = [
    {
      id: "a",
      title: "Backend senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT",
      classification: {
        primaryFamily: "backend",
        relatedFamilies: ["platform"],
        seniority: "senior",
      },
    },
    {
      id: "b",
      title: "Leadership senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT",
      classification: {
        primaryFamily: "leadership",
        relatedFamilies: ["backend"],
        seniority: "senior",
      },
    },
    {
      id: "c",
      title: "Fullstack junior",
      modality: "presencial",
      location: "Portugal",
      description: "PJ",
      classification: {
        primaryFamily: "fullstack",
        relatedFamilies: [],
        seniority: "junior",
      },
    },
    {
      id: "d",
      title: "DevOps senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT",
      classification: {
        primaryFamily: "devops",
        relatedFamilies: ["platform"],
        seniority: "senior",
      },
    },
    {
      id: "e",
      title: "Platform senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT",
      classification: {
        primaryFamily: "platform",
        relatedFamilies: [],
        seniority: "senior",
      },
    },
    {
      id: "p",
      title: "Product senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT Jira",
      classification: {
        primaryFamily: "product",
        relatedFamilies: [],
        seniority: "senior",
      },
    },
    {
      id: "q",
      title: "Product Design senior",
      modality: "remoto",
      location: "Brasil",
      description: "CLT Figma",
      classification: {
        primaryFamily: "product_design",
        relatedFamilies: [],
        seniority: "senior",
      },
    },
  ];
  beforeAll(async () => {
    await client.connect();
    mocks.getCache.mockResolvedValue(client);
  });
  afterAll(async () => {
    if (client.isOpen) {
      for (const key of owned) await client.del(key);
      await client.quit();
    }
  });
  beforeEach(async () => {
    for (const key of owned) await client.del(key);
    owned.clear();
    owned.add("scraper:jobs:index-version");
    owned.add("jobs:search:generation");
    await client.set("scraper:jobs:index-version", version);
    await client.set("jobs:search:generation", "1");
    const end = Math.floor(Date.now() / 1000) + 3600;
    for (const job of jobs) {
      owned.add(prefix + "job:" + job.id);
      await client.set(prefix + "job:" + job.id, JSON.stringify(job));
      owned.add(prefix + "index");
      await client.sAdd(prefix + "index", job.id);
      owned.add(prefix + "expires");
      await client.zAdd(prefix + "expires", { score: end, value: job.id });
      const families = [
        job.classification.primaryFamily,
        ...job.classification.relatedFamilies,
      ];
      for (const family of families) {
        owned.add(prefix + "family:" + family);
        await client.sAdd(prefix + "family:" + family, job.id);
      }
      const primary =
        prefix + "family:primary:" + job.classification.primaryFamily;
      owned.add(primary);
      await client.sAdd(primary, job.id);
      for (const family of job.classification.relatedFamilies) {
        owned.add(prefix + "family:related:" + family);
        await client.sAdd(prefix + "family:related:" + family, job.id);
      }
    }
  });
  async function search(query: Record<string, unknown>, page = 1, limit = 20) {
    return new JobSearchRepository().search(parseJobSearchQuery(query), {
      page,
      limit,
    });
  }
  function ids(result: { jobs: unknown[] }) {
    return result.jobs.map((j) => (j as { id: string }).id);
  }
  it.each([
    ["backend", "primary", ["a"]],
    ["backend", "any", ["a", "b"]],
    ["backend,fullstack", "primary", ["a", "c"]],
    ["backend,fullstack", "any", ["a", "b", "c"]],
    ["fullstack", "primary", ["c"]],
    ["backend,frontend,fullstack", "primary", ["a", "c"]],
    ["devops", "primary", ["d"]],
    ["platform", "primary", ["e"]],
    ["devops,platform", "primary", ["d", "e"]],
    ["platform", "any", ["a", "d", "e"]],
    ["product", "any", ["p"]],
    ["product_design", "primary", ["q"]],
  ])("union %s / %s", async (family, familyMode, expected) => {
    const result = await search({ family, familyMode });
    expect(ids(result)).toEqual(expected);
    expect(result.total).toBe(expected.length);
  });
  it("intersects before page and count", async () => {
    const query = {
      family: "backend,fullstack",
      familyMode: "any",
      seniority: "senior",
      type: "remoto",
      location: "Brasil",
      contract: "clt",
    };
    const first = await search(query, 1, 1),
      second = await search(query, 2, 1);
    expect(ids(first)).toEqual(["a"]);
    expect(ids(second)).toEqual(["b"]);
    expect(first.total).toBe(2);
    expect(second.total).toBe(2);
    expect(
      (await search({ ...query, family: "product,product_design" })).total,
    ).toBe(2);
  });

  it("bounds hydration for 1001 candidates and ranks without retaining catalog payloads", async () => {
    const multi = client.multi();
    const family = prefix + "family:backend",
      primary = prefix + "family:primary:backend";
    owned.add(family);
    owned.add(primary);
    for (let i = 0; i < 1001; i++) {
      const id = `load-${String(i).padStart(4, "0")}`;
      const key = prefix + "job:" + id;
      owned.add(key);
      multi.set(
        key,
        JSON.stringify({
          id,
          title: "Backend",
          classification: { primaryFamily: "backend" },
        }),
      );
      multi.sAdd(family, id);
      multi.sAdd(primary, id);
      multi.sAdd(prefix + "index", id);
      multi.zAdd(prefix + "expires", {
        value: id,
        score: Math.floor(Date.now() / 1000) + 3600,
      });
    }
    await multi.exec();
    const hydration = vi.spyOn(client, "mGet");
    try {
      const result = await search(
        { family: "backend", familyMode: "primary" },
        21,
        50,
      );
      expect(result.total).toBe(1002);
      expect(result.jobs).toHaveLength(2);
      expect(hydration.mock.calls.every(([keys]) => keys.length <= 200)).toBe(
        true,
      );
    } finally {
      hydration.mockRestore();
    }
  });
  it("normalizes equivalent queries and separates primary cache", async () => {
    const store = new ValkeySearchCacheStore();
    const generation = (await store.generation())!;
    const cache = new JobSearchCache(store, 90);
    const page = { page: 1, limit: 20 };
    const q = vi.fn().mockResolvedValue({ jobs: [], total: 0 });
    const a = parseJobSearchQuery({ family: "backend,fullstack" }),
      b = parseJobSearchQuery({
        family: ["fullstack", "backend,backend"],
        familyMode: "any",
      });
    const key = jobSearchCacheKey(a, page, generation);
    owned.add(key);
    await cache.search(a, page, null, q);
    await cache.search(b, page, null, q);
    expect(q).toHaveBeenCalledTimes(1);
    expect(await client.ttl(key)).toBeGreaterThan(0);
    expect(
      jobSearchCacheKey(
        parseJobSearchQuery({ family: "backend", familyMode: "primary" }),
        page,
        generation,
      ),
    ).not.toBe(
      jobSearchCacheKey(
        parseJobSearchQuery({ family: "backend" }),
        page,
        generation,
      ),
    );
  });
  it("rejects stale-generation writes and limits TTL by expiry", async () => {
    const store = new ValkeySearchCacheStore();
    let generation = (await store.generation())!;
    await client.incr("jobs:search:generation");
    const key = "jobs:search:v2:integration-stale";
    owned.add(key);
    expect(
      await store.writeIfGeneration(
        key,
        { jobs: [], total: 0 },
        generation,
        120,
      ),
    ).toBe(false);
    expect(await client.exists(key)).toBe(0);
    await client.zAdd(prefix + "expires", {
      value: "a",
      score: Math.floor(Date.now() / 1000) + 5,
    });
    generation = (await store.generation())!;
    expect(
      await store.writeIfGeneration(
        key,
        { jobs: [], total: 0 },
        generation,
        120,
      ),
    ).toBe(true);
    expect(await client.ttl(key)).toBeLessThanOrEqual(5);
    await client.zAdd(prefix + "expires", {
      value: "a",
      score: Math.floor(Date.now() / 1000) - 1,
    });
    expect(await store.generation()).toBe(null);
  });
  it("filters committed expiration and cleans temporary candidates", async () => {
    await client.zAdd(prefix + "expires", {
      value: "a",
      score: Math.floor(Date.now() / 1000) - 1,
    });
    const result = await search({ family: "backend" });
    expect(ids(result)).toEqual(["b"]);
    expect(result.total).toBe(1);
    const indexed = (await openIndexedSearch(
      parseJobSearchQuery({ family: "backend" }),
    ))!;
    await indexed.close();
    // SCAN audit, no KEYS command or broad cleanup.
    const candidates = [];
    for await (const keys of client.scanIterator({
      MATCH: "jobs:search:candidates:*",
      COUNT: 200,
    }))
      candidates.push(...keys);
    expect(candidates).toEqual([]);
  });
  it("preserves profile keyword priority and global match ordering", async () => {
    const kw = prefix + "keyword:figma";
    owned.add(kw);
    await client.sAdd(kw, "q");
    const result = await new JobSearchRepository().search(
      parseJobSearchQuery({}),
      { page: 1, limit: 1 },
      undefined,
      null,
      ["figma"],
    );
    expect(ids(result)).toEqual(["q"]);
    expect(result.total).toBe(7);
    const sorted = await new JobSearchRepository().search(
      parseJobSearchQuery({ family: "backend", matchSort: "desc" }),
      { page: 1, limit: 1 },
      async (batch) =>
        batch.map((j) => ({
          ...(j as object),
          matchScore: (j as { id: string }).id === "b" ? 90 : 50,
        })),
      "profile",
    );
    expect(ids(sorted)).toEqual(["b"]);
    expect(sorted.total).toBe(2);
  });
});
