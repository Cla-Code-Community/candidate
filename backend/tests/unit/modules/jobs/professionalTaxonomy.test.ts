import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  familyLabel,
  historicalAliases,
  isPublicFamily,
  normalizeFamily,
  normalizeJobTaxonomy,
  professionalFamilies,
  relatedFamilies,
  taxonomyVersion,
} from "../../../../src/modules/jobs/types/professionalTaxonomy";
describe("canonical taxonomy", () => {
  it("matches the Go canonical artifact including order, labels, version and aliases", () => {
    const contract = JSON.parse(
      readFileSync(
        new URL(
          "../../../../../scraper-go/internal/taxonomy/families.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(professionalFamilies).toEqual(contract.families);
    expect(taxonomyVersion).toBe(contract.taxonomyVersion);
    expect(historicalAliases).toEqual(contract.historicalAliases);
    expect(professionalFamilies).toHaveLength(13);
    expect(new Set(professionalFamilies.map((f) => f.id)).size).toBe(13);
    for (const f of professionalFamilies) {
      expect(f.id).toBe(f.id.toLowerCase());
      expect(f.label).toBeTruthy();
      expect(familyLabel(f.id)).toBe(f.label);
    }
    expect(familyLabel("other")).toBeUndefined();
    expect(familyLabel("unknown")).toBeUndefined();
    expect(isPublicFamily("other")).toBe(false);
    expect(isPublicFamily("unknown")).toBe(false);
  });
  it("normalizes historical metadata without mutating jobs or treating labels as IDs", () => {
    expect(normalizeFamily(" Backend ")).toBe("backend");
    expect(normalizeFamily("Dados")).toBe("data");
    expect(normalizeFamily("Infraestrutura")).toBe("devops");
    expect(normalizeFamily("Full Stack")).toBeUndefined();
    expect(normalizeFamily("unknown")).toBeUndefined();
    expect(normalizeFamily("software")).toBe("software");
    expect(
      relatedFamilies("backend", [
        "Backend",
        "Frontend",
        "frontend",
        "other",
        "unknown",
        "data",
      ]),
    ).toEqual(["frontend", "data"]);
    expect(relatedFamilies("backend", null)).toEqual([]);
    const original = {
      title: "Original",
      classification: {
        primaryFamily: "Backend",
        relatedFamilies: ["Backend", "Frontend"],
        confidence: 0.8,
      },
    };
    expect(normalizeJobTaxonomy(original)).toEqual({
      title: "Original",
      classification: {
        primaryFamily: "backend",
        relatedFamilies: ["frontend"],
        confidence: 0.8,
      },
    });
    expect(original.classification.primaryFamily).toBe("Backend");
    expect(
      normalizeJobTaxonomy({
        classification: { primaryFamily: "unknown", inScope: true },
      }),
    ).toEqual({
      classification: {
        primaryFamily: "other",
        relatedFamilies: [],
        inScope: false,
      },
    });
    for (const value of [null, undefined, [], "bad", { classification: null }])
      expect(normalizeJobTaxonomy(value)).toEqual(value);
  });
});
