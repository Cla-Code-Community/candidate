import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchJobIds,
  cacheSearchKeywords,
} from "../../../lib/cache";
import { paginate, parsePagination } from "../../../lib/pagination";
import { filterJobs, sortJobsByMatch } from "../filters/jobSearch.filter";
import {
  hasStructuredFilters,
  parseJobSearchQuery,
} from "../parsers/jobSearchQuery.parser";
import type { SearchJobsInput, SearchJobsResult } from "../types/jobSearch.types";
import type { MatchableJob } from "./jobMatch.service";
import { JobProfileMatchService } from "./jobProfileMatch.service";

async function legacyResolveIds(
  keywords: string[],
): Promise<{ ids: string[]; source: string }> {
  if (keywords.length > 0) {
    return {
      ids: await cacheSearchKeywords(keywords),
      source: `valkey_filtered_by_keywords:${keywords.join("+")}`,
    };
  }

  return {
    ids: await cacheAbsoluteSMembers("scraper:jobs:index"),
    source: "valkey_global_index",
  };
}

function toSearchResult(
  jobs: unknown[],
  pagination: ReturnType<typeof paginate>["pagination"],
  source: string,
): SearchJobsResult {
  return {
    total: pagination.total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: pagination.totalPages,
    hasNext: pagination.hasNext,
    hasPrev: pagination.hasPrev,
    jobs,
    source,
  };
}

export class SearchJobsService {
  constructor(
    private readonly profileMatchService = new JobProfileMatchService(),
  ) {}

  async execute(input: SearchJobsInput): Promise<SearchJobsResult> {
    const filters = parseJobSearchQuery(input.query);
    const pagination = parsePagination(input.query);
    const hasFilters = hasStructuredFilters(filters);
    const matchTechnologies =
      await this.profileMatchService.getUserTechnologies(input.userId);

    let ids: string[] = [];
    let source =
      filters.keywords.length > 0
        ? `valkey_filtered_by_keywords:${filters.keywords.join("+")}`
        : "valkey_global_index";

    if (hasFilters) {
      ids = await cacheSearchJobIds({
        keywords: filters.keywords,
        family: filters.family,
        technology: filters.technology,
        seniority: filters.seniority,
        level: filters.level,
        location: filters.location,
        continent: filters.continent,
        country: filters.country,
        state: filters.state,
        city: filters.city,
        type: filters.type,
        model: filters.type,
        contract: filters.contract,
      });
      source = `${source}:structured_indexes`;

      if (ids.length === 0) {
        return await this.searchWithPostFilterFallback(
          filters,
          pagination,
          matchTechnologies,
          input.userId,
          `${source}:legacy_post_filter_fallback`,
        );
      }

      const indexedJobs = await cacheGetJobsByIds(ids);
      const filteredJobs = filterJobs(indexedJobs, filters);
      return await this.paginateFilteredJobs(
        filteredJobs,
        filters.matchSort,
        pagination,
        matchTechnologies,
        input.userId,
        `${source}:verified`,
      );
    }

    const legacy = await legacyResolveIds(filters.keywords);
    ids = legacy.ids;
    source = legacy.source;

    if (filters.matchSort) {
      const allJobs = await cacheGetJobsByIds(ids);
      const matchedJobs = await this.profileMatchService.enrich(
        input.userId,
        allJobs as MatchableJob[],
        matchTechnologies,
        { notifyHighMatches: false },
      );
      const sortedJobs = sortJobsByMatch(matchedJobs, filters.matchSort);
      const { data: jobs, pagination: meta } = paginate(sortedJobs, pagination);
      await this.profileMatchService.enrich(
        input.userId,
        jobs as MatchableJob[],
        matchTechnologies,
      );

      return toSearchResult(jobs, meta, `${source}:match_sorted_${filters.matchSort}`);
    }

    const { data: pageIds, pagination: meta } = paginate(ids, pagination);
    const pageJobs = await cacheGetJobsByIds(pageIds);
    const jobs = await this.profileMatchService.enrich(
      input.userId,
      pageJobs as MatchableJob[],
      matchTechnologies,
    );

    return toSearchResult(jobs, meta, source);
  }

  private async searchWithPostFilterFallback(
    filters: ReturnType<typeof parseJobSearchQuery>,
    pagination: ReturnType<typeof parsePagination>,
    matchTechnologies: Parameters<JobProfileMatchService["enrich"]>[2],
    userId: string | undefined,
    source: string,
  ): Promise<SearchJobsResult> {
    const legacy = await legacyResolveIds(filters.keywords);
    const legacyJobs = await cacheGetJobsByIds(legacy.ids);
    const filteredJobs = filterJobs(legacyJobs, filters);

    return await this.paginateFilteredJobs(
      filteredJobs,
      filters.matchSort,
      pagination,
      matchTechnologies,
      userId,
      source,
    );
  }

  private async paginateFilteredJobs(
    jobs: unknown[],
    matchSort: "asc" | "desc" | null,
    pagination: ReturnType<typeof parsePagination>,
    matchTechnologies: Parameters<JobProfileMatchService["enrich"]>[2],
    userId: string | undefined,
    source: string,
  ): Promise<SearchJobsResult> {
    if (matchSort) {
      const matchedJobs = await this.profileMatchService.enrich(
        userId,
        jobs as MatchableJob[],
        matchTechnologies,
        { notifyHighMatches: false },
      );
      const { data: pageJobs, pagination: meta } = paginate(
        sortJobsByMatch(matchedJobs, matchSort),
        pagination,
      );
      await this.profileMatchService.enrich(
        userId,
        pageJobs as MatchableJob[],
        matchTechnologies,
      );

      return toSearchResult(pageJobs, meta, source);
    }

    const { data: pageJobs, pagination: meta } = paginate(jobs, pagination);
    const enrichedJobs = await this.profileMatchService.enrich(
      userId,
      pageJobs as MatchableJob[],
      matchTechnologies,
    );

    return toSearchResult(enrichedJobs, meta, source);
  }
}

export const searchJobsService = new SearchJobsService();
