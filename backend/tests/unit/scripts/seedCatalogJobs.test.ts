import { isPublicFamily } from "../../../src/modules/jobs/types/professionalTaxonomy";
import { describe, expect, it } from "vitest";

import { scoreJobWithTechnologies } from "../../../src/modules/jobs/services/jobMatch.service";
import type { MatchableJob } from "../../../src/modules/jobs/services/jobMatch.service";
import {
  SEED_CATALOG_JOBS,
  SEED_DEV_TECHNOLOGIES,
  catalogJobDocument,
  catalogJobIndexKeys,
} from "../../../src/scripts/seedCatalogJobs";

function scoreOf(spec: (typeof SEED_CATALOG_JOBS)[number]) {
  return scoreJobWithTechnologies(
    catalogJobDocument(spec) as MatchableJob,
    SEED_DEV_TECHNOLOGIES,
  );
}

describe("seedCatalogJobs", () => {
  it("usa somente IDs públicos canônicos", () => {
    for (const spec of SEED_CATALOG_JOBS) {
      expect(isPublicFamily(spec.family)).toBe(true);
      expect(catalogJobDocument(spec).classification.primaryFamily).toBe(spec.family);
    }
  });
  it("gera cada vaga com o match documentado em expectedMatch", () => {
    for (const spec of SEED_CATALOG_JOBS) {
      expect(scoreOf(spec).matchScore, spec.title).toBe(spec.expectedMatch);
    }
  });

  it("mantém o catálogo ordenado do maior para o menor match", () => {
    const scores = SEED_CATALOG_JOBS.map((spec) => scoreOf(spec).matchScore ?? 0);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(new Set(scores).size).toBe(scores.length);
  });

  it("casa exatamente as tecnologias declaradas no perfil", () => {
    const profile = new Set(
      SEED_DEV_TECHNOLOGIES.map((technology) => technology.name),
    );

    for (const spec of SEED_CATALOG_JOBS) {
      const expected = spec.technologies.filter((technology) =>
        profile.has(technology),
      );

      expect(scoreOf(spec).matchedTechnologies ?? [], spec.title).toEqual(
        expected,
      );
    }
  });

  it("indexa cada vaga nas chaves invertidas que o scraper escreveria", () => {
    for (const spec of SEED_CATALOG_JOBS) {
      const keys = catalogJobIndexKeys(spec);

      for (const technology of spec.technologies) {
        const normalized = technology
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

        expect(keys).toContain(`scraper:jobs:technology:${normalized}`);
        expect(keys).toContain(`scraper:jobs:keyword:${normalized}`);
      }

      expect(keys).toContain("scraper:jobs:country:brasil");
    }
  });

  it("usa IDs e URLs únicos por vaga", () => {
    const documents = SEED_CATALOG_JOBS.map(catalogJobDocument);

    expect(new Set(documents.map((job) => job.id)).size).toBe(documents.length);
    expect(new Set(documents.map((job) => job.url)).size).toBe(documents.length);
  });
});
