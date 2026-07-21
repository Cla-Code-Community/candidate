import { Request, Response, Router } from "express";
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchJobIds,
  cacheSearchKeywords,
} from "../lib/cache";
import { paginate, parsePagination } from "../lib/pagination";
import { logWarn } from "../logger";
import {
  getUserMatchTechnologies,
  MatchableJob,
  MatchedJob,
  scoreJobWithTechnologies,
} from "../modules/jobs/jobMatch.service";
import { NotificationsService } from "../modules/notifications/notifications.service";
import { UsersService } from "../modules/users/users.service";

export const jobsRoutes = Router();

type SearchJob = {
  title?: string | null;
  location?: string | null;
  modality?: string | null;
  description?: string | null;
};

type MatchTechnology = {
  name: string;
  years: number;
};

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLevelFilter(value: string): string {
  const normalized = normalizeComparable(value);
  if (
    normalized === "estagio trainee" ||
    normalized === "estagio" ||
    normalized === "trainee" ||
    normalized === "intern" ||
    normalized === "internship"
  ) {
    return "estagio";
  }
  return normalized;
}

function containsTokenOrPhrase(text: string, needle: string): boolean {
  if (needle.includes(" ")) return text.includes(needle);
  return ` ${text} `.includes(` ${needle} `);
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => containsTokenOrPhrase(text, needle));
}

function inferJobLevel(title: string): string {
  const normalized = normalizeComparable(title);
  if (
    containsAny(normalized, [
      "estagio",
      "estagiario",
      "intern",
      "internship",
      "trainee",
      "aprendiz",
    ])
  ) {
    return "estagio";
  }
  if (
    containsAny(normalized, [
      "senior",
      "sr",
      "especialista",
      "lead",
      "principal",
      "staff",
    ])
  ) {
    return "senior";
  }
  if (
    containsAny(normalized, ["junior", "jr", "entry level", "assistente"])
  ) {
    return "junior";
  }
  return "pleno";
}

function inferJobType(job: SearchJob): string {
  const normalized = normalizeComparable(
    [
      job.title,
      job.location,
      job.modality,
      job.description,
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (normalized.includes("hibrid") || normalized.includes("hybrid")) {
    return "hibrido";
  }
  if (
    normalized.includes("remot") ||
    normalized.includes("home office") ||
    normalized.includes("teletrabalho") ||
    normalized.includes("anywhere") ||
    normalized.includes("worldwide")
  ) {
    return "remoto";
  }
  if (
    normalized.includes("presencial") ||
    normalized.includes("onsite") ||
    normalized.includes("on site") ||
    normalized.includes("on-site") ||
    normalized.includes("in office") ||
    normalized.includes("escritorio")
  ) {
    return "presencial";
  }

  return "presencial";
}

function inferLocationCountry(location: string): string {
  const normalized = normalizeComparable(location);
  if (!normalized) return "";

  if (
    containsAny(normalized, [
      "estados unidos",
      "united states",
      "usa",
      "eua",
      "florida",
      "miami",
      "new york",
      "california",
      "texas",
      "boston",
      "seattle",
      "chicago",
      "atlanta",
      "denver",
    ])
  ) {
    return "estados unidos";
  }

  if (
    containsAny(normalized, [
      "brasil",
      "brazil",
      "sao paulo",
      "rio de janeiro",
      "minas gerais",
      "belo horizonte",
      "parana",
      "curitiba",
      "santa catarina",
      "joinville",
      "rio grande do sul",
      "porto alegre",
      "pernambuco",
      "recife",
      "bahia",
      "salvador",
      "ceara",
      "fortaleza",
      "piaui",
      "teresina",
    ])
  ) {
    return "brasil";
  }

  if (containsAny(normalized, ["portugal", "lisboa", "porto"])) {
    return "portugal";
  }

  return "";
}

function matchesLocationFilter(jobLocation: string, location: string): boolean {
  if (!location) return true;

  const normalizedLocation = normalizeComparable(jobLocation);
  const inferredCountry = inferLocationCountry(jobLocation);
  if (inferredCountry) return inferredCountry === location;

  return normalizedLocation.includes(location);
}

function filterJobs(jobs: unknown[], query: Request["query"]): unknown[] {
  const level = normalizeLevelFilter(firstQueryValue(query.level));
  const location = normalizeComparable(
    firstQueryValue(query.country) || firstQueryValue(query.location),
  );
  const type = normalizeComparable(
    firstQueryValue(query.model) || firstQueryValue(query.type),
  );

  if (!level && !location && !type) return jobs;

  return jobs.filter((job) => {
    const candidate = job as SearchJob;
    const title = candidate.title ?? "";
    const jobLocation = candidate.location ?? "";

    const matchesLevel = !level || inferJobLevel(title) === level;
    const matchesLocation = matchesLocationFilter(jobLocation, location);
    const matchesType = !type || inferJobType(candidate) === type;

    return matchesLevel && matchesLocation && matchesType;
  });
}

function hasStructuredFilters(query: Request["query"]): boolean {
  return Boolean(
    firstQueryValue(query.level) ||
      firstQueryValue(query.location) ||
      firstQueryValue(query.country) ||
      firstQueryValue(query.continent) ||
      firstQueryValue(query.state) ||
      firstQueryValue(query.city) ||
      firstQueryValue(query.type) ||
      firstQueryValue(query.model) ||
      firstQueryValue(query.contract) ||
      firstQueryValue(query.contractType) ||
      firstQueryValue(query.jobTypes),
  );
}

function getKeywordsArray(query: Request["query"]): string[] {
  const keywords = firstQueryValue(query.keywords);
  if (!keywords) return [];

  return keywords
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function getMatchSort(query: Request["query"]): "asc" | "desc" | null {
  const value = firstQueryValue(query.matchSort) || firstQueryValue(query.sort);
  return value === "asc" || value === "desc" ? value : null;
}

function sortJobsByMatch<T>(
  jobs: T[],
  direction: "asc" | "desc",
) {
  return [...jobs].sort((first, second) => {
    const firstJob = first as { matchScore?: number | null };
    const secondJob = second as { matchScore?: number | null };
    const firstScore =
      typeof firstJob.matchScore === "number" ? firstJob.matchScore : 0;
    const secondScore =
      typeof secondJob.matchScore === "number" ? secondJob.matchScore : 0;

    return direction === "desc"
      ? secondScore - firstScore
      : firstScore - secondScore;
  });
}

async function legacyResolveIds(
  keywordsArray: string[],
): Promise<{ ids: string[]; source: string }> {
  if (keywordsArray.length > 0) {
    return {
      ids: await cacheSearchKeywords(keywordsArray),
      source: `valkey_filtered_by_keywords:${keywordsArray.join("+")}`,
    };
  }

  return {
    ids: await cacheAbsoluteSMembers("scraper:jobs:index"),
    source: "valkey_global_index",
  };
}

async function getCurrentUserMatchTechnologies(req: Request) {
  const userId = req.session?.userId;
  if (!userId) return [];

  try {
    const user = await new UsersService().getUserById(userId);
    return getUserMatchTechnologies(user);
  } catch (error) {
    logWarn("Não foi possível carregar perfil para cálculo de match", {
      error: (error as Error).message,
      userId,
    });
    return [];
  }
}

async function enrichJobsWithProfileMatch(
  req: Request,
  jobs: unknown[],
  technologies: MatchTechnology[],
  options: { notifyHighMatches?: boolean } = {},
) {
  if (technologies.length === 0) return jobs;

  const matchedJobs = jobs.map((job) =>
    scoreJobWithTechnologies(job as MatchableJob, technologies),
  );
  if (options.notifyHighMatches === false) return matchedJobs;

  await notifyHighMatchJobs(req, matchedJobs);
  return matchedJobs;
}

async function notifyHighMatchJobs(req: Request, matchedJobs: MatchedJob[]) {
  const userId = req.session?.userId;
  if (!userId) return;

  const notifications = new NotificationsService();
  await Promise.all(
    matchedJobs
      .filter((job) => (job.matchScore ?? 0) >= 85)
      .map((job) =>
        notifications.createHighMatchIfMissing(userId, job).catch((error) => {
          logWarn("Não foi possível registrar notificação de alto match", {
            error: (error as Error).message,
            userId,
            job: job.title ?? job.jobTitle ?? job.id,
          });
        }),
      ),
  );
}

/**
 * @swagger
 * /api/jobs/search:
 * get:
 * summary: Busca vagas em memória RAM no Valkey usando índices invertidos e interseção
 * tags: [Jobs]
 * parameters:
 * - in: query
 * name: keywords
 * schema:
 * type: string
 * description: 'Termos para filtrar (ex: "react,node") separados por vírgula'
 */
jobsRoutes.get("/search", async (req: Request, res: Response) => {
  try {
    const keywordsArray = getKeywordsArray(req.query);
    const pagination = parsePagination(req.query);
    const hasFilters = hasStructuredFilters(req.query);
    const matchSort = getMatchSort(req.query);
    const matchTechnologies = await getCurrentUserMatchTechnologies(req);

    let ids: string[] = [];
    let source =
      keywordsArray.length > 0
        ? `valkey_filtered_by_keywords:${keywordsArray.join("+")}`
        : "valkey_global_index";

    if (hasFilters) {
      ids = await cacheSearchJobIds({
        keywords: keywordsArray,
        level: firstQueryValue(req.query.level),
        location: firstQueryValue(req.query.location),
        continent: firstQueryValue(req.query.continent),
        country: firstQueryValue(req.query.country),
        state: firstQueryValue(req.query.state),
        city: firstQueryValue(req.query.city),
        type: firstQueryValue(req.query.type),
        model: firstQueryValue(req.query.model),
        contract:
          firstQueryValue(req.query.contract) ||
          firstQueryValue(req.query.contractType) ||
          firstQueryValue(req.query.jobTypes),
      });
      source = `${source}:structured_indexes`;

      if (ids.length === 0) {
        const legacy = await legacyResolveIds(keywordsArray);
        const legacyJobs = await cacheGetJobsByIds(legacy.ids);
        const filteredJobs = filterJobs(legacyJobs, req.query);
        const { data: pageJobs, pagination: meta } = matchSort
          ? paginate(
              sortJobsByMatch(
                await enrichJobsWithProfileMatch(
                  req,
                  filteredJobs,
                  matchTechnologies,
                  { notifyHighMatches: false },
                ),
                matchSort,
              ),
              pagination,
            )
          : paginate(filteredJobs, pagination);
        if (matchSort) {
          await notifyHighMatchJobs(req, pageJobs as MatchedJob[]);
        }
        const jobs = matchSort
          ? pageJobs
          : await enrichJobsWithProfileMatch(
              req,
              pageJobs,
              matchTechnologies,
            );

        return res.json({
          total: meta.total,
          page: meta.page,
          limit: meta.limit,
          totalPages: meta.totalPages,
          hasNext: meta.hasNext,
          hasPrev: meta.hasPrev,
          jobs,
          source: `${source}:legacy_post_filter_fallback`,
        });
      }

      const indexedJobs = await cacheGetJobsByIds(ids);
      const filteredJobs = filterJobs(indexedJobs, req.query);
      const { data: pageJobs, pagination: meta } = matchSort
        ? paginate(
            sortJobsByMatch(
              await enrichJobsWithProfileMatch(
                req,
                filteredJobs,
                matchTechnologies,
                { notifyHighMatches: false },
              ),
              matchSort,
            ),
            pagination,
          )
        : paginate(filteredJobs, pagination);
      if (matchSort) {
        await notifyHighMatchJobs(req, pageJobs as MatchedJob[]);
      }
      const jobs = matchSort
        ? pageJobs
        : await enrichJobsWithProfileMatch(
            req,
            pageJobs,
            matchTechnologies,
          );

      return res.json({
        total: meta.total,
        page: meta.page,
        limit: meta.limit,
        totalPages: meta.totalPages,
        hasNext: meta.hasNext,
        hasPrev: meta.hasPrev,
        jobs,
        source: `${source}:verified`,
      });
    } else {
      const legacy = await legacyResolveIds(keywordsArray);
      ids = legacy.ids;
      source = legacy.source;
    }

    if (matchSort) {
      const allJobs = await cacheGetJobsByIds(ids);
      const matchedJobs = await enrichJobsWithProfileMatch(
        req,
        allJobs,
        matchTechnologies,
        { notifyHighMatches: false },
      );
      const sortedJobs = sortJobsByMatch(matchedJobs, matchSort);
      const { data: jobs, pagination: meta } = paginate(
        sortedJobs,
        pagination,
      );
      await notifyHighMatchJobs(req, jobs as MatchedJob[]);

      return res.json({
        total: meta.total,
        page: meta.page,
        limit: meta.limit,
        totalPages: meta.totalPages,
        hasNext: meta.hasNext,
        hasPrev: meta.hasPrev,
        jobs,
        source: `${source}:match_sorted_${matchSort}`,
      });
    }

    const { data: pageIds, pagination: meta } = paginate(ids, pagination);
    const pageJobs = await cacheGetJobsByIds(pageIds);
    const jobs = await enrichJobsWithProfileMatch(
      req,
      pageJobs,
      matchTechnologies,
    );

    return res.json({
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      totalPages: meta.totalPages,
      hasNext: meta.hasNext,
      hasPrev: meta.hasPrev,
      jobs,
      source,
    });
  } catch (error) {
    logWarn("Erro ao buscar vagas no ecossistema Valkey", {
      error: (error as Error).message,
    });
    return res.status(500).json({
      message: "Erro ao recuperar vagas em memória.",
      error: (error as Error).message,
    });
  }
});
