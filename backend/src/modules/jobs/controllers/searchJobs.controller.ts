import type { NextFunction, Request, Response } from "express";
import { logWarn } from "../../../logger";
import { jobSearchesTotal } from "../../../metrics/metrics";
import { searchJobsService } from "../services/searchJobs.service";

function hasKeywords(query: Request["query"]): boolean {
  const value = query.keywords;
  const values = Array.isArray(value) ? value : [value];

  return values.some((item) => {
    if (typeof item !== "string") return false;
    return item
      .split(",")
      .some((keyword) => keyword.trim().length > 0);
  });
}

export async function searchJobsController(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  jobSearchesTotal.inc({ has_keywords: hasKeywords(req.query) ? "true" : "false" });

  try {
    const result = await searchJobsService.execute({
      query: req.query,
      userId: req.session?.userId,
    });

    res.json(result);
  } catch (error) {
    logWarn("Erro ao buscar vagas no ecossistema Valkey", {
      error: (error as Error).message,
    });
    res.status(500).json({
      message: "Erro ao recuperar vagas em memória.",
      error: (error as Error).message,
    });
  }
}
