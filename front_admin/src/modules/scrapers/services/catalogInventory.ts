import type { ScraperJobsCountResponse } from "../../../lib/api/types";

const NAMES: Record<string, string> = {
  linkedin: "LinkedIn", adzuna: "Adzuna", themuse: "The Muse", gupy: "Gupy",
  inhire: "InHire", jooble: "Jooble", greenhouse: "Greenhouse", lever: "Lever",
  unknown: "Provider não reconhecido",
};
export interface CatalogProvider {
  id: string; name: string; provider: string; configured: boolean | null;
  catalogJobs: number | null; observed: boolean | null;
}

function normalizeSource(source: string | null, provider: string) {
  const parts = new Map<string, string>();
  for (const value of (source ?? "").split(",")) {
    const name = value.trim();
    if (!name) continue;
    // Match the existing provider mapping: case, spaces and provider qualifiers.
    const candidate = name.toLowerCase().split(":")[0].replace(/\s/g, "");
    const known = candidate !== "unknown" && Object.hasOwn(NAMES, candidate);
    const id = known ? candidate : `source:value:${name.toLowerCase()}`;
    parts.set(id, known ? NAMES[candidate] : name);
  }
  const entries = [...parts.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  if (entries.length === 0) return { id: "source:null", name: "Sem fonte principal", provider: "unknown" };
  if (entries.length === 1) {
    const [key, name] = entries[0];
    const id = provider !== "unknown" ? provider : key;
    return { id, name: NAMES[id] ?? name, provider: Object.hasOwn(NAMES, id) ? id : "unknown" };
  }
  return {
    id: `source:combination:${JSON.stringify(entries.map(([id]) => id))}`,
    name: entries.map(([, name]) => name).join(" + "),
    provider: "unknown",
  };
}

// Preview is deliberately not an input. Equivalent provenance groups merge;
// a catalog entry still belongs to exactly one group, never to each member.
export function buildCatalogInventory(count: ScraperJobsCountResponse | null): CatalogProvider[] {
  if (!count) return [];
  const rows = new Map<string, CatalogProvider>();
  const configured = count.configuredProviders;
  for (const id of configured ?? []) {
    rows.set(id, { id, name: NAMES[id] ?? id, provider: id, configured: true, catalogJobs: count.sources == null ? null : 0, observed: count.sources == null ? null : false });
  }
  for (const source of count.sources ?? []) {
    const normalized = normalizeSource(source.source, source.provider);
    const row = rows.get(normalized.id) ?? {
      ...normalized,
      configured: normalized.id === "source:null" || configured == null || (normalized.provider === "unknown" && configured.includes("unknown"))
        ? null : normalized.provider !== "unknown" && configured.some(id => id === normalized.provider),
      catalogJobs: 0,
      observed: false,
    };
    row.catalogJobs = (row.catalogJobs ?? 0) + source.total;
    row.observed = row.catalogJobs > 0;
    rows.set(row.id, row);
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
