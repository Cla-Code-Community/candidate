import { describe, expect, it } from "vitest";
import { parseFamilyQuery } from "../../../../src/modules/jobs/parsers/familyQuery.parser";
import { professionalFamilies } from "../../../../src/modules/jobs/types/professionalTaxonomy";

describe("family query contract", () => {
  it.each([
    ["backend", ["backend"]],
    ["fullstack,backend", ["backend", "fullstack"]],
    [
      ["fullstack", "backend"],
      ["backend", "fullstack"],
    ],
    [
      [" fullstack, backend ", "backend,,"],
      ["backend", "fullstack"],
    ],
    ["backend,", ["backend"]],
    [
      professionalFamilies
        .map((f) => f.id)
        .reverse()
        .join(","),
      professionalFamilies.map((f) => f.id).sort(),
    ],
  ])("normalizes %j deterministically", (family, expected) => {
    expect(parseFamilyQuery({ family })).toEqual({
      families: expected,
      familyMode: "any",
    });
  });
  it.each(["primary", "any"])(
    "accepts %s with or without families",
    (familyMode) => {
      expect(
        parseFamilyQuery({ family: "backend", familyMode }).familyMode,
      ).toBe(familyMode);
      expect(parseFamilyQuery({ familyMode })).toEqual({
        families: [],
        familyMode,
      });
    },
  );
  it("defaults without family", () =>
    expect(parseFamilyQuery({})).toEqual({ families: [], familyMode: "any" }));
  it.each([
    "",
    ",,,",
    " ",
    "backend,finance",
    "other",
    "Backend",
    "Full Stack",
    "Dados e IA",
    "Design de Produto",
    "dados",
    { id: "backend" },
    ["backend", {}],
  ])("rejects invalid family %j", (family) => {
    expect(() => parseFamilyQuery({ family })).toThrow(
      expect.objectContaining({ code: "INVALID_JOB_FAMILY", statusCode: 400 }),
    );
  });
  it.each(["related", "", "ANY", ["primary", "any"], {}])(
    "rejects invalid mode %j even without family",
    (familyMode) => {
      expect(() => parseFamilyQuery({ familyMode })).toThrow(
        expect.objectContaining({
          code: "INVALID_FAMILY_MODE",
          statusCode: 400,
        }),
      );
    },
  );
  it.each(professionalFamilies.map((f) => f.id))(
    "accepts canonical %s",
    (family) => {
      expect(parseFamilyQuery({ family }).families).toEqual([family]);
    },
  );
  it("deduplicates before applying maximum", () => {
    expect(
      parseFamilyQuery({ family: Array(30).fill("backend") }).families,
    ).toEqual(["backend"]);
  });
});
