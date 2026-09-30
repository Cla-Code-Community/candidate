import {
    cacheAbsoluteSMembers,
    cacheGetJobsByIds,
    cacheGetJobsByIdsDetailed,
    cacheRemoveJobIndexIds,
    cacheSearchJobIds,
    cacheSearchKeywords,
} from "../../../lib/cache";
import { paginate, parsePagination } from "../../../lib/pagination";
import { logWarn } from "../../../logger";
import { filterJobs, sortJobsByMatch } from "../filters/jobSearch.filter";
import {
    hasPostOnlyFilters,
    hasStructuredFilters,
    parseJobSearchQuery,
} from "../parsers/jobSearchQuery.parser";
import type {
    MatchTechnology,
    SearchJobsInput,
    SearchJobsResult,
} from "../types/jobSearch.types";
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


const MAX_HYDRATION_WINDOWS = 10;

async function removeOrphanIds(missingIds: string[]): Promise<void> {
  if (missingIds.length === 0) return;

  try {
    await cacheRemoveJobIndexIds(missingIds);
  } catch (error) {
    logWarn("Falha ao remover IDs órfãos do índice global de vagas", {
      error: (error as Error).message,
      orphans: missingIds.length,
    });
  }
}

async function hydrateIndexPage(
  ids: string[],
  { page, limit }: ReturnType<typeof parsePagination>,
): Promise<{ jobs: unknown[]; meta: ReturnType<typeof paginate>["pagination"] }> {
  const jobs: unknown[] = [];
  const missingIds: string[] = [];
  let cursor = (page - 1) * limit;
  let windows = 0;

  while (
    jobs.length < limit &&
    cursor < ids.length &&
    windows < MAX_HYDRATION_WINDOWS
  ) {
    const window = ids.slice(cursor, cursor + (limit - jobs.length));
    const hydrated = await cacheGetJobsByIdsDetailed(window);

    jobs.push(...hydrated.jobs);
    missingIds.push(...hydrated.missingIds);
    cursor += window.length;
    windows += 1;
  }

  await removeOrphanIds(missingIds);

  const total = Math.max(0, ids.length - missingIds.length);
  const totalPages = Math.ceil(total / limit);

  return {
    jobs,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

async function orderIdsByProfileRelevance(
  ids: string[],
  technologies: MatchTechnology[],
): Promise<{ ids: string[]; matchedIds: number }> {
  const names = technologies
    .map((technology) => technology.name?.trim())
    .filter((name): name is string => Boolean(name));

  if (names.length === 0 || ids.length === 0) {
    return { ids, matchedIds: 0 };
  }

  let profileIds: string[];
  try {
    profileIds = await cacheSearchKeywords(names);
  } catch (error) {
    logWarn("Não foi possível priorizar vagas pelo perfil do candidato", {
      error: (error as Error).message,
    });
    return { ids, matchedIds: 0 };
  }

  if (profileIds.length === 0) return { ids, matchedIds: 0 };

  const relevant = new Set(profileIds);
  const preferred: string[] = [];
  const remaining: string[] = [];

  for (const id of ids) {
    if (relevant.has(id)) preferred.push(id);
    else remaining.push(id);
  }

  if (preferred.length === 0) return { ids, matchedIds: 0 };

  return { ids: [...preferred, ...remaining], matchedIds: preferred.length };
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

    if (hasPostOnlyFilters(filters)) {
      const legacyJobs = await cacheGetJobsByIds(ids);
      return await this.paginateFilteredJobs(
        filterJobs(legacyJobs, filters),
        filters.matchSort,
        pagination,
        matchTechnologies,
        input.userId,
        `${source}:post_filter`,
      );
    }

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

    const relevance = await orderIdsByProfileRelevance(ids, matchTechnologies);
    const { jobs: pageJobs, meta } = await hydrateIndexPage(
      relevance.ids,
      pagination,
    );
    const jobs = await this.profileMatchService.enrich(
      input.userId,
      pageJobs as MatchableJob[],
      matchTechnologies,
    );

    if (relevance.matchedIds === 0) {
      return toSearchResult(jobs, meta, source);
    }  return toSearchResult(
      sortJobsByMatch(jobs, "desc"),
      meta,
      `${source}:profile_ranked`,
    );
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
