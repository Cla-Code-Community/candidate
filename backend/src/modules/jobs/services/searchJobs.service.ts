import { hasActiveJobIndex } from "../repositories/valkeyJobSearch.adapter";
import { JobSearchRepository } from "../repositories/jobSearch.repository";
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIdsDetailed,
  cacheRemoveJobIndexIds,
  cacheSearchKeywords,
} from "../../../lib/cache";
import { paginate, parsePagination } from "../../../lib/pagination";
import { logWarn } from "../../../logger";
import { sortJobsByMatch } from "../filters/jobSearch.filter";
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
import type { MatchPreferences, MatchableJob } from "./jobMatch.service";
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
): Promise<{
  jobs: unknown[];
  meta: ReturnType<typeof paginate>["pagination"];
}> {
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
    private readonly repository = new JobSearchRepository(),
  ) {}

  async execute(input: SearchJobsInput): Promise<SearchJobsResult> {
    const filters = parseJobSearchQuery(input.query);
    const pagination = parsePagination(input.query);
    const hasFilters = hasStructuredFilters(filters);
    let preferences: MatchPreferences | undefined;
    const matchTechnologies =
      await this.profileMatchService.getUserTechnologies(
        input.userId,
        (value) => {
          preferences = value;
        },
      );
    const preferenceOptions = preferences ? { preferences } : {};

    let ids: string[] = [];
    let source =
      filters.keywords.length > 0
        ? `valkey_filtered_by_keywords:${filters.keywords.join("+")}`
        : "valkey_global_index";

    const indexedDefault =
      !hasFilters &&
      !hasPostOnlyFilters(filters) &&
      !filters.matchSort &&
      (await hasActiveJobIndex());
    if (
      hasFilters ||
      hasPostOnlyFilters(filters) ||
      filters.matchSort ||
      indexedDefault
    ) {
      const result = await this.repository.search(
        filters,
        pagination,
        filters.matchSort
          ? async (jobs) =>
              this.profileMatchService.enrich(
                input.userId,
                jobs as MatchableJob[],
                matchTechnologies,
                { notifyHighMatches: false, ...preferenceOptions },
              )
          : undefined,
        {
          preferences,
          technologies: [...matchTechnologies]
            .map((t) => ({ name: t.name.trim().toLowerCase(), years: t.years }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.years - b.years),
        },
        indexedDefault ? matchTechnologies.map((t) => t.name) : [],
      );
      const jobs = await this.profileMatchService.enrich(
        input.userId,
        result.jobs as MatchableJob[],
        matchTechnologies,
        ...(preferences ? [preferenceOptions] : []),
      );
      const totalPages = Math.ceil(result.total / pagination.limit);
      return toSearchResult(
        indexedDefault && matchTechnologies.length
          ? sortJobsByMatch(jobs, "desc")
          : jobs,
        {
          ...pagination,
          total: result.total,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
        },
        `${source}:verified_batches${filters.matchSort ? `:match_sorted_${filters.matchSort}` : ""}`,
      );
    }

    const legacy = await legacyResolveIds(filters.keywords);
    ids = legacy.ids;
    source = legacy.source;

    const relevance = await orderIdsByProfileRelevance(ids, matchTechnologies);
    const { jobs: pageJobs, meta } = await hydrateIndexPage(
      relevance.ids,
      pagination,
    );
    const jobs = await this.profileMatchService.enrich(
      input.userId,
      pageJobs as MatchableJob[],
      matchTechnologies,
      ...(preferences ? [preferenceOptions] : []),
    );

    if (relevance.matchedIds === 0) {
      return toSearchResult(jobs, meta, source);
    }
    return toSearchResult(
      sortJobsByMatch(jobs, "desc"),
      meta,
      `${source}:profile_ranked`,
    );
  }
}

export const searchJobsService = new SearchJobsService();
