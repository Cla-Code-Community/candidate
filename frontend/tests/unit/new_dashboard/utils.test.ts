import type { Job, JobModelFilter, JobType } from "@/domains/new_dashboard/types";
import {
    createJobFromForm,
    getInitials,
    splitTags,
} from "@/domains/new_dashboard/utils/helpers";
import {
    getJobTypesFromModelFilter,
    getModelFilterFromJobTypes,
    modelFilterMatchesJob,
    modelFilterToApiFilter,
} from "@/domains/new_dashboard/utils/jobModelFilters";
import {
    getContinentFromLocation,
    matchesContinent,
    matchesCountry,
    matchesLocationFilters,
} from "@/domains/new_dashboard/utils/locationFilters";
import { parseSearchKeywords } from "@/domains/new_dashboard/utils/searchKeywords";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("new_dashboard utils", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("splits tags and trims empty values", () => {
    expect(splitTags("React, TypeScript, , Node.js")).toEqual([
      "React",
      "TypeScript",
      "Node.js",
    ]);
  });

  it("creates a normalized job from form data", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "job-123" });
    vi.spyOn(Math, "random").mockReturnValue(0);

    const job = createJobFromForm({
      jobTitle: "  Frontend Developer  ",
      company: "  ACME  ",
      location: "  ",
      salary: "  ",
      type: "Remoto",
      level: "Pleno",
      tags: "React, TypeScript",
      source: "  ",
      jobLink: "  ",
      notes: "  nota  ",
    });

    expect(job).toMatchObject({
      id: "job-123",
      jobTitle: "Frontend Developer",
      company: "ACME",
      location: "Remoto",
      salary: "A combinar",
      type: "Remoto",
      level: "Pleno",
      matchScore: 70,
      tags: ["React", "TypeScript"],
      posted: "Agora mesmo",
      status: "saved",
      jobLink: "#",
      source: "Manual",
      notes: "nota",
    });
  });

  it("derives initials from a display name", () => {
    expect(getInitials("Maria Clara")).toBe("MC");
    expect(getInitials("Ana")).toBe("A");
  });

  it("detects filters by continent and country", () => {
    expect(getContinentFromLocation("São Paulo, Brasil")).toBe(
      "América do Sul",
    );
    expect(getContinentFromLocation("Remote / Worldwide")).toBe(
      "Global / Remoto",
    );
    expect(matchesCountry("São Paulo, Brasil", "Brasil")).toBe(true);
    expect(matchesCountry("Lisboa, Portugal", "Brasil")).toBe(false);
    expect(matchesContinent("Lisboa, Portugal", "Europa")).toBe(true);
    expect(matchesContinent("Lisboa, Portugal", "América do Sul")).toBe(
      false,
    );
    expect(
      matchesLocationFilters(
        { location: "Berlin, Alemania" },
        "Europa",
        "Todos",
      ),
    ).toBe(true);
  });

  it("maps model filters to supported job types and back", () => {
    expect(getJobTypesFromModelFilter("Todos")).toEqual([]);
    expect(getJobTypesFromModelFilter("RemotoHibrido")).toEqual([
      "Remoto",
      "Híbrido",
    ]);
    expect(getModelFilterFromJobTypes(["Híbrido", "Remoto", "Remoto"])).toBe(
      "RemotoHibrido",
    );
    expect(getModelFilterFromJobTypes(["Presencial", "Remoto"])).toBe(
      "RemotoPresencial",
    );
    expect(getModelFilterFromJobTypes(["Remoto"])).toBe("Remoto");
    expect(getModelFilterFromJobTypes([])).toBe("Todos");
    expect(getJobTypesFromModelFilter("not-a-filter" as JobModelFilter)).toEqual(
      [],
    );
    expect(
      getModelFilterFromJobTypes(["Remoto", "Híbrido", "Presencial"] as JobType[]),
    ).toBe("Todos");
  });

  it("matches job model filters and serializes API filters", () => {
    const job = { type: "Híbrido" } as Job;

    expect(modelFilterMatchesJob(job, "Todos")).toBe(true);
    expect(modelFilterMatchesJob(job, "RemotoHibrido")).toBe(true);
    expect(modelFilterMatchesJob(job, "Remoto")).toBe(false);
    expect(modelFilterToApiFilter("Todos")).toEqual({});
    expect(modelFilterToApiFilter("RemotoHibrido")).toEqual({
      type: "Remoto,Híbrido",
      model: "Remoto,Híbrido",
    });
    expect(modelFilterToApiFilter("Presencial" as JobModelFilter)).toEqual({
      type: "Presencial",
      model: "Presencial",
    });
  });

  it("detects unknown and global locations and combines country/continent", () => {
    expect(getContinentFromLocation("Remote from an unknown region")).toBe(
      "Global / Remoto",
    );
    expect(getContinentFromLocation("Atlantis")).toBe("Desconhecido");
    expect(matchesCountry("Lisboa, Portugal", "Todos")).toBe(true);
    expect(matchesContinent("Lisboa, Portugal", "Todos")).toBe(true);
    expect(matchesContinent("Remote / Worldwide", "Global / Remoto")).toBe(
      true,
    );
    expect(matchesContinent("Lisboa, Portugal", "Global / Remoto")).toBe(
      false,
    );
    expect(
      matchesLocationFilters(
        { location: "São Paulo, Brasil" },
        "América do Sul",
        "Brasil",
      ),
    ).toBe(true);
    expect(
      matchesLocationFilters(
        { location: "Lisboa, Portugal" },
        "Europa",
        "Brasil",
      ),
    ).toBe(false);
  });

  it("splits search keywords, trims whitespace and removes duplicates", () => {
    expect(parseSearchKeywords(" Go, React TypeScript;\nNode.js  Go ")).toEqual(
      ["Go", "React", "TypeScript", "Node.js"],
    );
    expect(parseSearchKeywords(" , ; \n  ")).toEqual([]);
  });
});
