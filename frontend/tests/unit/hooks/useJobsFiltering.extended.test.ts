import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useJobsFiltering } from "@/domains/jobs/application/useJobsFiltering";

describe("useJobsFiltering extended", () => {
  it("normaliza acentuação e sinais na busca", () => {
    const jobs = [
      {
        titulo: "Desenvolvedor Sênior",
        empresa: "Companhia",
        local: "São Paulo",
        palavra: "React",
        link: "https://example.com/vaga",
      },
    ];

    const { result } = renderHook(() =>
      useJobsFiltering(jobs, "sênior companhia são", []),
    );

    expect(result.current.filteredJobs).toHaveLength(1);
  });

  it("deduplica por URL ignorando query e hash", () => {
    const jobs = [
      {
        titulo: "Dev Full",
        empresa: "ACME",
        local: "BR",
        palavra: "React",
        link: "https://example.com/jobs/1?utm=aaa#anchor",
      },
      {
        titulo: "Dev Full",
        empresa: "ACME",
        local: "BR",
        palavra: "Node",
        link: "https://example.com/jobs/1?utm=bbb",
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", []));

    expect(result.current.filteredJobs).toHaveLength(1);
    expect(result.current.filteredJobs[0].palavra).toContain("React");
    expect(result.current.filteredJobs[0].palavra).toContain("Node");
  });

  it("filtra por palavras-chave selecionadas", () => {
    const jobs = [
      { titulo: "A", empresa: "A", local: "A", palavra: "React", link: "1" },
      { titulo: "B", empresa: "B", local: "B", palavra: "Go", link: "2" },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", ["Go"]));

    expect(result.current.filteredJobs).toHaveLength(1);
    expect(result.current.filteredJobs[0].titulo).toBe("B");
  });

  it("suporta fallback quando dados principais estão vazios", () => {
    const jobs = [
      {
        titulo: "",
        empresa: "",
        local: "",
        palavra: "QA",
        link: "url-sem-protocolo?x=1#y",
        source: "Feed",
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "qa", []));

    expect(result.current.filteredJobs).toHaveLength(1);
    expect(result.current.keywords).toContain("QA");
  });

  it("deduplica por titulo e empresa quando local está vazio", () => {
    const jobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "",
        palavra: "React",
        link: "https://different1.com",
      },
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "",
        palavra: "Node",
        link: "https://different2.com",
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", []));

    expect(result.current.filteredJobs).toHaveLength(1);
    expect(result.current.filteredJobs[0].palavra).toContain("React");
    expect(result.current.filteredJobs[0].palavra).toContain("Node");
  });

  it("deduplica por fallback quando link está vazio", () => {
    const jobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "React",
        link: "",
        source: "LinkedIn",
      },
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "Node",
        link: "",
        source: "LinkedIn",
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", []));

    expect(result.current.filteredJobs).toHaveLength(1);
    expect(result.current.filteredJobs[0].palavra).toContain("React");
    expect(result.current.filteredJobs[0].palavra).toContain("Node");
  });

  it("normaliza link vazio ou null corretamente", () => {
    const jobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "React",
        link: null,
        source: "LinkedIn",
      },
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "Node",
        link: "",
        source: "LinkedIn",
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", []));

    // Ambos devem ser dedplicados pois nao tem link valido
    expect(result.current.filteredJobs).toHaveLength(1);
  });

  it("combina multiplos filtros de keywords", () => {
    const jobs = [
      {
        titulo: "A",
        empresa: "A",
        local: "A",
        palavra: "React, Node",
        link: "1",
      },
      { titulo: "B", empresa: "B", local: "B", palavra: "Go, Rust", link: "2" },
      {
        titulo: "C",
        empresa: "C",
        local: "C",
        palavra: "React, Go",
        link: "3",
      },
    ];

    const { result } = renderHook(() =>
      useJobsFiltering(jobs, "", ["React", "Go"]),
    );

    expect(result.current.filteredJobs).toHaveLength(3);
  });

  it("retorna lista vazia quando busca nao tem resultado", () => {
    const jobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "React",
        link: "1",
      },
    ];

    const { result } = renderHook(() =>
      useJobsFiltering(jobs, "XYZ123NoMatch", []),
    );

    expect(result.current.filteredJobs).toHaveLength(0);
  });

  it("respeita tipo de array no campo keywords do job", () => {
    const jobs = [
      {
        titulo: "Dev",
        empresa: "ACME",
        local: "SP",
        palavra: "React, Node",
        link: "1",
        keywords: ["TypeScript", "Webpack"],
      },
    ];

    const { result } = renderHook(() => useJobsFiltering(jobs, "", []));

    expect(result.current.keywords).toContain("React");
    expect(result.current.keywords).toContain("Node");
    expect(result.current.keywords).toContain("TypeScript");
    expect(result.current.keywords).toContain("Webpack");
  });
});
