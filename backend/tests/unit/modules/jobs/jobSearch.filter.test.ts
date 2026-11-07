import { describe, expect, it } from "vitest";
import {
  filterJobs,
  prepareJobFilter,
  normalizeComparable,
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
  it("reutiliza filtros preparados entre lotes preservando ordem e documentos", () => {
    const apply = prepareJobFilter(filters({ company: "acme", country: "Brasil", family: "backend", technology: "Go", contract: "clt" }));
    expect([...apply(JOBS.slice(0, 1)), ...apply(JOBS.slice(1))]).toEqual([JOBS[0]]);
    expect(apply(JOBS)).toEqual([JOBS[0]]);
    expect(apply([])).toEqual([]);
  });

  it("isola a preparação de mudanças posteriores dos filtros e preserva o caminho sem filtros", () => {
    const query = filters({ family: "backend", familyMode: "primary" });
    const apply = prepareJobFilter(query);
    query.families.push("frontend");
    query.familyMode = "any";
    const data = [JOBS[0], JOBS[1], { id: "related", classification: { primaryFamily: "leadership", relatedFamilies: ["backend"] } }];
    expect(apply(data)).toEqual([JOBS[0]]);
    expect(prepareJobFilter(query)(data)).toEqual(data);
    expect(prepareJobFilter(filters({}))(JOBS)).toBe(JOBS);
  });
  it("preserva fallback textual e precedência do país em filtros combinados", () => {
    const data = [
      { id: "known", company: "Acme", location: "Toronto, Canadá" },
      { id: "unknown", company: "Acme", location: "Atlantis Central" },
      { id: "empty", company: "Acme" },
    ];
    const ids = (query: Record<string, unknown>) =>
      filterJobs(data, filters(query)).map((job) => (job as { id: string }).id);
    expect(ids({ company: "acme" })).toEqual(["known", "unknown", "empty"]);
    expect(ids({ location: "atlantis", company: "acme" })).toEqual(["unknown"]);
    expect(ids({ country: "Canadá", location: "atlantis", city: "Toronto" })).toEqual(["known"]);
    expect(ids({ country: "Brasil", city: "Toronto" })).toEqual([]);
  });

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


describe("inferência de modalidade sem normalizar separadores do documento inteiro", () => {
  const cases: [string, Record<string, string>, string][] = [
    ["remoto explícito", { modality: "Remoto" }, "remoto"],
    ["híbrido explícito", { modality: "HÍBRIDO" }, "hibrido"],
    ["presencial explícito", { modality: "Presencial" }, "presencial"],
    ["ausente", {}, "presencial"],
    ["sem descrição", { title: "Remote engineer" }, "remoto"],
    ["híbrido inglês", { description: "HYBRID working" }, "hibrido"],
    ["acentos", { description: "Trabalho RÉMÓTO" }, "remoto"],
    ["home office", { description: "HOME OFFICE" }, "remoto"],
    ["pontuação", { description: "home---office" }, "remoto"],
    ["separadores Unicode", { description: "home\u00a0—\nOFFICE" }, "remoto"],
    ["letra entre palavras", { description: "home界office" }, "presencial"],
    ["número entre palavras", { description: "home1office" }, "presencial"],
    ["sem separador", { description: "homeoffice" }, "presencial"],
    ["frase entre campos", { title: "home", location: "office" }, "remoto"],
    ["teletrabalho", { description: "TELETRABALHO" }, "remoto"],
    ["anywhere", { location: "Anywhere" }, "remoto"],
    ["worldwide", { location: "Worldwide" }, "remoto"],
    ["onsite", { description: "Onsite" }, "presencial"],
    ["on-site", { description: "On-Site" }, "presencial"],
    ["in office", { description: "In Office" }, "presencial"],
    ["escritório", { description: "ESCRITÓRIO" }, "presencial"],
    ["descrição híbrida vence remoto estruturado", { modality: "Remote", description: "HYBRID" }, "hibrido"],
    ["híbrido estruturado vence descrição remota", { modality: "Hybrid", description: "Remote" }, "hibrido"],
    ["remoto vence presencial", { modality: "Presencial", description: "Remote" }, "remoto"],
    ["todos os termos", { description: "Presencial, remote, híbrido" }, "hibrido"],
    ["acento decomposto", { description: "hi\u0301brido" }, "hibrido"],
  ];

  it.each(cases)("preserva %s", (_name, data, expected) => {
    const job = { id: "test", ...data };
    for (const type of ["remoto", "hibrido", "presencial"]) {
      expect(filterJobs([job], filters({ type })).length).toBe(type === expected ? 1 : 0);
    }
  });

  it("mantém IDs e ordem da regra anterior com combinações de campos e Unicode", () => {
    const terms = ["", "Remote", "Híbrido", "Onsite", "home", "office", "home---office", "home界office", "home1office", "teletrabalho", "Worldwide", "hi\u0301brido"];
    const data = terms.flatMap((modality, i) => terms.map((description, j) => ({
      id: `${i}-${j}`, title: i % 2 ? "home" : "Engineer", company: "Acme",
      location: "Brasil", modality, description,
    })));
    function previousType(job: typeof data[number]) {
      const text = normalizeComparable([job.title, job.location, job.modality, job.description].filter(Boolean).join(" "));
      if (text.includes("hibrid") || text.includes("hybrid")) return "hibrido";
      if (["remot", "home office", "teletrabalho", "anywhere", "worldwide"].some(alias => text.includes(alias))) return "remoto";
      return "presencial";
    }
    for (const type of ["remoto", "hibrido", "presencial", "remoto,hibrido"]) {
      const expected = data.filter(job => type.split(",").includes(previousType(job))).map(job => job.id);
      const actual = filterJobs(data, filters({ type, company: "acme", country: "Brasil" }));
      expect(actual.map(job => (job as { id: string }).id)).toEqual(expected);
    }
  });
});
