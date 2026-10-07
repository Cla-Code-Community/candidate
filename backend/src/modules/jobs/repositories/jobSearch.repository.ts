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
  ): Promise<{ jobs: unknown[]; total: number }> {
    const ids = [
      ...new Set(
        filters.keywords.length
          ? await cacheSearchKeywords(filters.keywords)
          : await cacheAbsoluteSMembers("scraper:jobs:index"),
      ),
    ];
    const offset = (pagination.page - 1) * pagination.limit;
    const capacity = Math.min(ids.length, offset + pagination.limit);
    let total = 0;
    const page: unknown[] = [];
    let ranked: RankedJob[] = [];
    const compare = (a: RankedJob, b: RankedJob) =>
      (filters.matchSort === "asc" ? a.score - b.score : b.score - a.score) ||
      a.rank - b.rank;

    for (let cursor = 0; cursor < ids.length; cursor += BATCH_SIZE) {
      const matches = filterJobs(
        await cacheGetJobsByIds(ids.slice(cursor, cursor + BATCH_SIZE)),
        filters,
      );
      if (filters.matchSort && enrich) {
        const jobs = await enrich(matches);
        const candidates = jobs.map((job, index) => ({
          id: String((job as { id: string }).id),
          rank: total + index,
          score: (job as { matchScore?: number }).matchScore ?? 0,
        }));
        ranked = [...ranked, ...candidates].sort(compare).slice(0, capacity);
      } else {
        for (const job of matches) {
          if (total >= offset && page.length < pagination.limit) page.push(job);
          total++;
        }
        continue;
      }
      total += matches.length;
    }
    return {
      jobs:
        filters.matchSort && enrich
          ? await cacheGetJobsByIds(
              ranked
                .slice(offset, offset + pagination.limit)
                .map((item) => item.id),
            )
          : page,
      total,
    };
  }
}
