import { jobSearchCacheKey } from "./jobSearchFingerprint";
import type { PaginationParams } from "../../../lib/pagination";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";

export type SearchPage = { jobs: unknown[]; total: number };
export interface SearchCacheStore {
  generation(): Promise<string | null>;
  read(key: string): Promise<SearchPage | null>;
  // The adapter must compare generation atomically before writing.
  writeIfGeneration(
    key: string,
    page: SearchPage,
    generation: string,
    ttlSeconds: number,
  ): Promise<boolean>;
}

/** Local single-flight combines simultaneous identical queries without reusing
 * the scraper execution lock. Failures never remain in the in-flight map.
 * Cache lookup/publication failures degrade to the normal repository query.
 */
export class JobSearchCache {
  private readonly inFlight = new Map<string, Promise<SearchPage>>();

  constructor(
    private readonly store: SearchCacheStore,
    private readonly ttlSeconds = 120,
  ) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 86400) {
      throw new Error(
        "JOB_SEARCH_CACHE_TTL_SECONDS must be an integer between 1 and 86400",
      );
    }
  }

  async search(
    filters: ParsedJobSearchQuery,
    pagination: PaginationParams,
    rankingContext: unknown,
    query: () => Promise<SearchPage>,
  ): Promise<SearchPage> {
    let generation: string | null;
    try {
      generation = await this.store.generation();
    } catch {
      return query();
    }
    // null means indexes are unavailable or being rebuilt; do not cache.
    if (generation === null) return query();
    const key = jobSearchCacheKey(
      filters,
      pagination,
      generation,
      rankingContext,
    );
    const existing = this.inFlight.get(key);
    if (existing) return structuredClone(await existing);

    const pending = (async () => {
      try {
        const cached = await this.store.read(key);
        if (cached && (await this.store.generation()) === generation)
          return cached;
      } catch {
        // A cache outage must not hide a successful persistence query.
      }
      const page = await query();
      try {
        await this.store.writeIfGeneration(
          key,
          page,
          generation,
          this.ttlSeconds,
        );
      } catch {
        // The query remains useful; the next request can repopulate the cache.
      }
      return page;
    })();
    this.inFlight.set(key, pending);
    try {
      return structuredClone(await pending);
    } finally {
      this.inFlight.delete(key);
    }
  }
}
