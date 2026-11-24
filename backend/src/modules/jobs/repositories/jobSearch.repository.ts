import { performance } from "node:perf_hooks";
import { logger } from "../../../logger";
import { searchPageCache } from "../cache/valkeySearchCache.adapter";
import { openIndexedSearch } from "./valkeyJobSearch.adapter";
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchKeywords,
} from "../../../lib/cache";
import type { PaginationParams } from "../../../lib/pagination";
import { prepareJobFilter } from "../filters/jobSearch.filter";
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
    // Opt-in: only aggregate timings/counts; never log filters, IDs or profile data.
    const diagnostics = process.env.JOB_SEARCH_DIAGNOSTICS === "1";
    const clock = () => (diagnostics ? performance.now() : 0);
    const started = clock();
    let batches = 0;
    let hydratedDocuments = 0;
    let matchedDocuments = 0;
    let returnedDocuments = 0;
    let hydrationMs = 0;
    let filterMs = 0;
    let matchMs = 0;
    let rankingMs = 0;
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
    const candidatesMs = clock() - started;
    let hydrationStarted = clock();
    try {
      const preparationStarted = clock();
      const applyFilters = prepareJobFilter(filters);
      filterMs += clock() - preparationStarted;
      hydrationStarted = clock();
      for await (const batch of indexed ? indexed.batches() : legacyBatches()) {
        hydrationMs += clock() - hydrationStarted;
        batches++;
        hydratedDocuments += batch.length;
        const filterStarted = clock();
        const matches = applyFilters(batch);
        filterMs += clock() - filterStarted;
        matchedDocuments += matches.length;
        if (filters.matchSort && enrich) {
          const matchStarted = clock();
          const jobs = await enrich(matches);
          matchMs += clock() - matchStarted;
          const rankingStarted = clock();
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
          rankingMs += clock() - rankingStarted;
        } else {
          for (const job of matches) {
            if (total >= offset && page.length < pagination.limit)
              page.push(job);
            total++;
          }
          hydrationStarted = clock();
          continue;
        }
        total += matches.length;
        hydrationStarted = clock();
      }
      hydrationMs += clock() - hydrationStarted;
      let resultJobs = page;
      if (filters.matchSort && enrich) {
        let pageIds: string[];
        if (indexed) {
          const rankingStarted = clock();
          pageIds = await indexed.rankedIds(offset, pagination.limit, total);
          rankingMs += clock() - rankingStarted;
        } else {
          pageIds = ranked
            .slice(offset, offset + pagination.limit)
            .map((item) => item.id);
        }
        const pageHydrationStarted = clock();
        resultJobs = indexed
          ? await indexed.hydrate(pageIds)
          : await cacheGetJobsByIds(pageIds);
        hydrationMs += clock() - pageHydrationStarted;
        hydratedDocuments += resultJobs.length;
      }
      returnedDocuments = resultJobs.length;
      return { jobs: resultJobs, total };
    } finally {
      try {
        await indexed?.close();
      } finally {
        if (diagnostics) {
          logger.info({
            durationMs: clock() - started,
            candidatesMs, hydrationMs, filterMs, matchMs, rankingMs,
            batches, hydratedDocuments, matchedDocuments, returnedDocuments, total,
            indexed: Boolean(indexed), matchSorted: Boolean(filters.matchSort),
          }, "Diagnóstico agregado da busca de vagas");
        }
      }
    }
  }
}
