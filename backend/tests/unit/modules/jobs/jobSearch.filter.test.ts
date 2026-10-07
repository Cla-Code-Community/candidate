import { describe, expect, it } from "vitest";
import {
  filterJobs,
  inferJobLocationParts,
  sortJobsByMatch,
} from "../../../../src/modules/jobs/filters/jobSearch.filter";
import { parseJobSearchQuery } from "../../../../src/modules/jobs/parsers/jobSearchQuery.parser";

function filters(query: Record<string, unknown>) {
  return parseJobSearchQuery(query as never);
}

const JOBS = [
  {
    id: "1",
    title: "Desenvolvedor Go Sênior",
    company: "ACME Tecnologia",
    location: "Joinville, Santa Catarina - Brasil",
    description: "Vaga presencial CLT",
    classification: {
      primaryFamily: "Backend",
      technologies: ["Go", "PostgreSQL"],
      seniority: "Sênior",
    },
  },
  {
    id: "2",
    title: "Desenvolvedora Frontend Júnior",
    company: "Globo",
    location: "Remoto - Worldwide",
    description: "Contrato PJ, home office",
    classification: {
      primaryFamily: "Frontend",
      technologies: ["React"],
      seniority: "Júnior",
    },
  },
  {
    id: "3",
    title: "Engenheiro de Dados Pleno",
    company: "Acme Labs",
    location: "Toronto, Canadá",
    description: "Hybrid role, full time",
    classification: {
      primaryFamily: "Data",
      technologies: ["Python"],
      seniority: "Pleno",
    },
  },
];

describe("inferJobLocationParts", () => {
  it("infere país, continente, estado e cidade como o scraper Go", () => {
    expect(inferJobLocationParts("Joinville, Santa Catarina - Brasil")).toEqual({
      country: "brasil",
      continent: "america do sul",
      location: "brasil",
      state: "sc",
      city: "joinville",
    });
  });

  it("classifica vagas sem país como 'global remoto'", () => {
    const parts = inferJobLocationParts("Remoto - Worldwide");
    expect(parts.continent).toBe("global remoto");
    expect(parts.country).toBe("");
  });

  it("reconhece países fora de Brasil/EUA/Portugal", () => {
    expect(inferJobLocationParts("Toronto, Canadá").country).toBe("canada");
    expect(inferJobLocationParts("Toronto, Canadá").continent).toBe(
      "america do norte",
    );
  });
});

describe("filterJobs", () => {
  it("devolve tudo quando não há filtros", () => {
    expect(filterJobs(JOBS, filters({}))).toHaveLength(3);
  });

  it("filtra por empresa ignorando acento e caixa", () => {
    const result = filterJobs(JOBS, filters({ company: "acme" }));
    expect(result.map((job) => (job as { id: string }).id)).toEqual(["1", "3"]);
  });

  it("filtra por contrato espelhando a inferência do scraper", () => {
    expect(filterJobs(JOBS, filters({ contract: "pj" }))).toHaveLength(1);
    // "CLT" (vaga 1) e "full time" (vaga 3) são tratados como CLT, igual ao Go.
    expect(filterJobs(JOBS, filters({ contract: "clt" }))).toHaveLength(2);
  });

  it("filtra por continente, estado e cidade", () => {
    expect(
      filterJobs(JOBS, filters({ continent: "Global / Remoto" })),
    ).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ state: "SC" }))).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ city: "Joinville" }))).toHaveLength(1);
  });

  it("filtra por país usando a mesma tabela do índice", () => {
    expect(filterJobs(JOBS, filters({ country: "Canadá" }))).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ country: "Brasil" }))).toHaveLength(1);
  });

  it("filtra por tecnologia e família da classificação", () => {
    expect(filterJobs(JOBS, filters({ technology: "Go" }))).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ family: "frontend" }))).toHaveLength(1);
  });

  it("filtra por senioridade e modalidade", () => {
    expect(filterJobs(JOBS, filters({ seniority: "Sênior" }))).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ type: "remoto" }))).toHaveLength(1);
    expect(filterJobs(JOBS, filters({ model: "hibrido" }))).toHaveLength(1);
  });

  it("combina múltiplos filtros com AND", () => {
    expect(
      filterJobs(JOBS, filters({ company: "acme", country: "Brasil" })),
    ).toHaveLength(1);
    expect(
      filterJobs(JOBS, filters({ company: "acme", contract: "pj" })),
    ).toHaveLength(0);
  });

  it("ignora filtros vazios ou nulos", () => {
    expect(
      filterJobs(
        JOBS,
        filters({ company: "", country: "  ", technology: ",", level: "" }),
      ),
    ).toHaveLength(3);
  });
});

describe("sortJobsByMatch", () => {
  it("ordena por matchScore tratando ausência como zero", () => {
    const jobs = [{ id: "a" }, { id: "b", matchScore: 90 }, { id: "c", matchScore: 50 }];
    expect(sortJobsByMatch(jobs, "desc").map((job) => job.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortJobsByMatch(jobs, "asc").map((job) => job.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});
