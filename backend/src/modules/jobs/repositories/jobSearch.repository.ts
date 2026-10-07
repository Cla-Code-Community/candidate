import { searchPageCache } from "../cache/valkeySearchCache.adapter";
import { openIndexedSearch } from "./valkeyJobSearch.adapter";
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchKeywords,
} from "../../../lib/cache";
import type { PaginationParams } from "../../../lib/pagination";
import { filterJobs } from "../filters/jobSearch.filter";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";

const BATCH_SIZE = 200;
type RankedJob = { id: string; rank: number; score: number };

/** Until classification indexes exist, verify persisted documents in bounded batches.
 * Keep only the requested page (or its top-ranked prefix), never all job documents.
 * Keyword resolution retains the existing union/alias semantics.
 */
export class JobSearchRepository {
  async search(
    filters: ParsedJobSearchQuery,
    pagination: PaginationParams,
    enrich?: (jobs: unknown[]) => Promise<unknown[]>,
    rankingContext: unknown = null,
    priorityKeywords: string[] = [],
  ): Promise<{ jobs: unknown[]; total: number }> {
    return searchPageCache.search(
      filters,
      pagination,
      {
        rankingContext,
        priorityKeywords: [
          ...new Set(priorityKeywords.map((x) => x.trim().toLowerCase())),
        ].sort(),
      },
      () => this.query(filters, pagination, enrich, priorityKeywords),
    );
  }

  private async query(
    filters: ParsedJobSearchQuery,
    pagination: PaginationParams,
    enrich?: (jobs: unknown[]) => Promise<unknown[]>,
    priorityKeywords: string[] = [],
  ): Promise<{ jobs: unknown[]; total: number }> {
    const indexed = await openIndexedSearch(filters, priorityKeywords);
    const ids = indexed
      ? []
      : [
          ...new Set(
            filters.keywords.length
              ? await cacheSearchKeywords(filters.keywords)
              : await cacheAbsoluteSMembers("scraper:jobs:index"),
          ),
        ];
    const offset = (pagination.page - 1) * pagination.limit;
    const capacity = indexed
      ? offset + pagination.limit
      : Math.min(ids.length, offset + pagination.limit);
    let total = 0;
    const page: unknown[] = [];
    let ranked: RankedJob[] = [];
    const compare = (a: RankedJob, b: RankedJob) =>
      (filters.matchSort === "asc" ? a.score - b.score : b.score - a.score) ||
      a.rank - b.rank;

    async function* legacyBatches() {
      for (let cursor = 0; cursor < ids.length; cursor += BATCH_SIZE)
        yield await cacheGetJobsByIds(ids.slice(cursor, cursor + BATCH_SIZE));
    }
    try {
      for await (const batch of indexed ? indexed.batches() : legacyBatches()) {
        const matches = filterJobs(batch, filters);
        if (filters.matchSort && enrich) {
          const jobs = await enrich(matches);
          const candidates = jobs.map((job, index) => ({
            id: String((job as { id: string }).id),
            rank: total + index,
            score: (job as { matchScore?: number }).matchScore ?? 0,
          }));
          if (indexed) await indexed.rank(candidates, filters.matchSort);
          else
            ranked = [...ranked, ...candidates]
              .sort(compare)
              .slice(0, capacity);
        } else {
          for (const job of matches) {
            if (total >= offset && page.length < pagination.limit)
              page.push(job);
            total++;
          }
          continue;
        }
        total += matches.length;
      }
      if (indexed && filters.matchSort && enrich) {
        page.push(
          ...(await indexed.hydrate(
            await indexed.rankedIds(offset, pagination.limit, total),
          )),
        );
      }
    } finally {
      await indexed?.close();
    }
    return {
      jobs:
        filters.matchSort && enrich
          ? indexed
            ? page
            : await cacheGetJobsByIds(
                ranked
                  .slice(offset, offset + pagination.limit)
                  .map((item) => item.id),
              )
          : page,
      total,
    };
  }
}
