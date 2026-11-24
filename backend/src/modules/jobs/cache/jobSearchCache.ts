import {
  searchCacheRequests,
  searchCacheDuration,
} from "../../../metrics/metrics";
import { jobSearchCacheKey } from "./jobSearchFingerprint";
import type { PaginationParams } from "../../../lib/pagination";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";
import { AppError } from "../../../lib/errors";

class GenerationChanged extends Error {
  constructor(readonly reason = "generation_changed") { super(reason); }
}

function unavailable(reason: string): AppError {
  return new AppError("SEARCH_CATALOG_UNAVAILABLE", "Catálogo de vagas temporariamente indisponível. Tente novamente.", 503, { reason });
}

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
 * Page-cache failures may degrade to a query; catalog fences must remain valid.
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
    let outcome: "hit" | "miss" | "stale" | "error" = "miss";
    try {
      // At most one reconstruction, shared under each generation's fingerprint.
      for (let attempt = 0; attempt < 2; attempt++) {
        const generation = await this.readGeneration();
        const key = jobSearchCacheKey(filters, pagination, generation, rankingContext);
        let pending = this.inFlight.get(key);
        if (pending) outcome = "hit";
        else {
          pending = (async () => {
            let cached: SearchPage | null = null;
            const getEnd = searchCacheDuration.startTimer({ operation: "get" });
            try { cached = await this.store.read(key); }
            catch { outcome = "error"; }
            finally { getEnd(); }
            if (cached) { outcome = "hit"; return cached; }
            await this.requireGeneration(generation);
            const page = await query();
            await this.requireGeneration(generation);
            let published: boolean | undefined;
            const setEnd = searchCacheDuration.startTimer({ operation: "set" });
            try {
              published = await this.store.writeIfGeneration(key, page, generation, this.ttlSeconds);
            } catch { outcome = "error"; }
            finally { setEnd(); }
            if (published === false) throw new GenerationChanged("publication_rejected");
            return page;
          })();
          this.inFlight.set(key, pending);
        }
        try {
          const page = structuredClone(await pending);
          // Also fences hits, shared results and changes during publication.
          await this.requireGeneration(generation);
          return page;
        } catch (error) {
          if (!(error instanceof GenerationChanged)) throw error;
          outcome = "stale";
          if (attempt === 1) throw unavailable(error.reason);
        } finally {
          if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
        }
      }
      throw unavailable("generation_changed");
    } catch (error) {
      if (error instanceof AppError && error.details?.reason === "catalog_unavailable") outcome = "stale";
      else if (!(error instanceof AppError && ["generation_changed", "publication_rejected"].includes(String(error.details?.reason)))) outcome = "error";
      throw error;
    } finally {
      searchCacheRequests.inc({ result: outcome });
    }
  }

  private async readGeneration(): Promise<string> {
    const end = searchCacheDuration.startTimer({ operation: "get" });
    let generation: string | null;
    try { generation = await this.store.generation(); }
    catch { throw unavailable("generation_read_failed"); }
    finally { end(); }
    if (generation === null) throw unavailable("catalog_unavailable");
    return generation;
  }

  private async requireGeneration(expected: string): Promise<void> {
    if (await this.readGeneration() !== expected) throw new GenerationChanged();
  }
}
