import { createHash } from "node:crypto";
import type { PaginationParams } from "../../../lib/pagination";
import type { ParsedJobSearchQuery } from "../types/jobSearch.types";
import {
  taxonomyVersion,
  professionalFamilies,
} from "../types/professionalTaxonomy";

// Bump when query, index or ranking semantics change, independently of taxonomy.
export const searchContractVersion = "v2";
const text = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
const values = (items: string[]) =>
  [...new Set(items.map(text).filter(Boolean))].sort();

/** Accept only already validated search filters. No raw query, PII or text is
 * exposed in the returned key. Profile-dependent ordering must include its
 * normalized ranking inputs; never share a personalized result anonymously.
 */
export function jobSearchCacheKey(
  filters: ParsedJobSearchQuery,
  pagination: PaginationParams,
  generation: string,
  rankingContext: unknown = null,
): string {
  const normalized = {
    contractVersion: searchContractVersion,
    taxonomyVersion,
    taxonomyHash: createHash("sha256")
      .update(JSON.stringify(professionalFamilies))
      .digest("hex"),
    generation,
    families: [...new Set(filters.families)].sort(),
    familyMode: filters.familyMode,
    keywords: values(filters.keywords),
    technology: values(filters.technology),
    company: values(filters.company),
    type: values(filters.type),
    level: text(filters.level),
    seniority: text(filters.seniority),
    location: text(filters.location),
    continent: text(filters.continent),
    country: text(filters.country),
    state: text(filters.state),
    city: text(filters.city),
    contract: text(filters.contract),
    ordering: filters.matchSort,
    page: pagination.page,
    limit: pagination.limit,
    rankingContext,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  return `jobs:search:${searchContractVersion}:${fingerprint}`;
}
