import { Request, Response, Router } from "express";
import {
  cacheAbsoluteSMembers,
  cacheGetJobsByIds,
  cacheSearchKeywords,
} from "../lib/cache";
import { paginate, parsePagination } from "../lib/pagination";
import { logWarn } from "../logger";

export const jobsRoutes = Router();

type SearchJob = {
  title?: string | null;
  location?: string | null;
  modality?: string | null;
  description?: string | null;
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
    .trim();
}

function inferJobLevel(title: string): string {
  const normalized = normalizeComparable(title);
  if (normalized.includes("senior") || normalized.includes("sr")) {
    return "senior";
  }
  if (normalized.includes("junior") || normalized.includes("jr")) {
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

function filterJobs(jobs: unknown[], query: Request["query"]): unknown[] {
  const level = normalizeComparable(firstQueryValue(query.level));
  const location = normalizeComparable(firstQueryValue(query.location));
  const type = normalizeComparable(firstQueryValue(query.type));

  if (!level && !location && !type) return jobs;

  return jobs.filter((job) => {
    const candidate = job as SearchJob;
    const title = candidate.title ?? "";
    const jobLocation = candidate.location ?? "";
    const normalizedLocation = normalizeComparable(jobLocation);

    const matchesLevel = !level || inferJobLevel(title) === level;
    const matchesLocation =
      !location || normalizedLocation.includes(location);
    const matchesType = !type || inferJobType(candidate) === type;

    return matchesLevel && matchesLocation && matchesType;
  });
}

function hasPostFetchFilters(query: Request["query"]): boolean {
  return Boolean(
    firstQueryValue(query.level) ||
      firstQueryValue(query.location) ||
      firstQueryValue(query.type),
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
    const { keywords } = req.query;
    const pagination = parsePagination(req.query);

    let ids: string[] = [];
    let source = "valkey_global_index";

    if (keywords) {
      const keywordsArray = String(keywords)
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      ids = await cacheSearchKeywords(keywordsArray);
      source = `valkey_filtered_by_keywords:${keywordsArray.join("+")}`;
    } else {
      ids = await cacheAbsoluteSMembers("scraper:jobs:index");
    }

    if (!hasPostFetchFilters(req.query)) {
      const { data: pageIds, pagination: meta } = paginate(ids, pagination);
      const jobs = await cacheGetJobsByIds(pageIds);

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
    }

    const allJobs = await cacheGetJobsByIds(ids);
    const filteredJobs = filterJobs(allJobs, req.query);
    const { data: jobs, pagination: meta } = paginate(filteredJobs, pagination);

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
