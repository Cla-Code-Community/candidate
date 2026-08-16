import type { Request } from "express";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";

export function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim() : "";
}

export function queryValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseJobSearchQuery(
  query: Request["query"],
): ParsedJobSearchQuery {
  const matchSortValue =
    firstQueryValue(query.matchSort) || firstQueryValue(query.sort);
  const type =
    queryValues(query.model).length > 0
      ? queryValues(query.model)
      : queryValues(query.type);

  return {
    keywords: queryValues(query.keywords),
    family: queryValues(query.family),
    technology: queryValues(query.technology),
    type,
    level: firstQueryValue(query.level),
    seniority: firstQueryValue(query.seniority),
    location: firstQueryValue(query.location),
    continent: firstQueryValue(query.continent),
    country: firstQueryValue(query.country),
    state: firstQueryValue(query.state),
    city: firstQueryValue(query.city),
    contract:
      firstQueryValue(query.contract) ||
      firstQueryValue(query.contractType) ||
      firstQueryValue(query.jobTypes),
    matchSort:
      matchSortValue === "asc" || matchSortValue === "desc"
        ? matchSortValue
        : null,
  };
}

export function hasStructuredFilters(filters: ParsedJobSearchQuery): boolean {
  return Boolean(
    filters.level ||
      filters.location ||
      filters.country ||
      filters.continent ||
      filters.state ||
      filters.city ||
      filters.family.length > 0 ||
      filters.technology.length > 0 ||
      filters.seniority ||
      filters.type.length > 0 ||
      filters.contract,
  );
}
