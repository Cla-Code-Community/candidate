import { AppError } from "../../../lib/errors";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";
import {
  isPublicFamily,
  professionalFamilies,
} from "../types/professionalTaxonomy";

export function parseFamilyQuery(
  query: Record<string, unknown>,
): Pick<ParsedJobSearchQuery, "families" | "familyMode"> {
  const mode = query.familyMode;
  if (mode !== undefined && mode !== "any" && mode !== "primary") {
    throw new AppError(
      "INVALID_FAMILY_MODE",
      "familyMode deve ser any ou primary.",
      400,
    );
  }
  if (query.family === undefined)
    return { families: [], familyMode: mode ?? "any" };

  const raw = Array.isArray(query.family) ? query.family : [query.family];
  if (raw.some((value) => typeof value !== "string")) {
    throw new AppError(
      "INVALID_JOB_FAMILY",
      "family deve conter IDs canônicos de famílias.",
      400,
    );
  }
  const values = [
    ...new Set(
      (raw as string[])
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
  if (
    values.length === 0 ||
    values.length > professionalFamilies.length ||
    values.some((value) => !isPublicFamily(value))
  ) {
    throw new AppError(
      "INVALID_JOB_FAMILY",
      "Informe de 1 a 13 famílias públicas válidas.",
      400,
    );
  }
  return { families: values.filter(isPublicFamily), familyMode: mode ?? "any" };
}
