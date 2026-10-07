import { ResumePreview } from "@/domains/new_dashboard/components/profile/ResumePreview";
import type { ResumeAnalysis } from "@/domains/new_dashboard/infrastructure/resumeApi";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function fullAnalysis(overrides: Partial<ResumeAnalysis> = {}): ResumeAnalysis {
  return {
    resume: {
      name: "Ana Souza",
      title: "Desenvolvedora Backend",
      summary: "Engenheira de software com foco em APIs.",
      contact: { email: "ana@x.com", phone: "+55 11 9", portfolio: "ana.dev" },
      links: { linkedin: "linkedin.com/in/ana", github: "github.com/ana" },
      skills: { Linguagens: ["TypeScript", "Java"], Backend: ["Node.js"] },
      experience: [
        {
          empresa: "Acme",
          cargo: "Dev",
          periodo: "2023 - Atual",
          stack: "Node.js, TypeScript",
          atividades: ["Desenvolvi APIs REST"],
          resultados: ["Reduziu latência em 30%"],
        },
      ],
      projects: [
        {
          name: "Api Gateway",
          stack: "Node.js",
          description: "Gateway de APIs",
          highlights: ["120 stars"],
        },
      ],
      education: ["USP - Ciência da Computação"],
      languages: ["Português - Nativo"],
    },
    atsReport: {
      score: 92,
      status: "PASSED",
      breakdown: {
        keywords: 90,
        experience: 60,
        technicalSkills: 95,
        structure: 100,
        achievements: 40,
        readability: 88,
      },
      matchedKeywords: ["node.js", "typescript"],
      missingKeywords: ["kubernetes"],
      weakSections: [],
      recommendations: ["Adicione mais resultados mensuráveis."],
    },
    warnings: ["GitHub import parcial."],
    sourcesUsed: ["candidate", "github", "linkedin", "outra"],
    job: { title: "Backend", hasDescription: true },
    ...overrides,
  };
}

function emptyAnalysis(): ResumeAnalysis {
  return {
    resume: {
      name: "João",
      title: "",
      summary: "",
      contact: { email: "", phone: "", portfolio: "" },
      links: { linkedin: "", github: "" },
      skills: {},
      experience: [],
      projects: [],
      education: [],
      languages: [],
    },
    atsReport: {
      score: 30,
      status: "INSUFFICIENT_DATA",
      breakdown: {
        keywords: 20,
        experience: 0,
        technicalSkills: 10,
        structure: 40,
        achievements: 0,
        readability: 60,
      },
      matchedKeywords: [],
      missingKeywords: [],
      weakSections: [],
      recommendations: [],
    },
    warnings: [],
    sourcesUsed: ["candidate"],
    job: { title: null, hasDescription: false },
  };
}

describe("ResumePreview", () => {
  it("renderiza o documento completo e o painel de análise", () => {
    render(<ResumePreview analysis={fullAnalysis()} />);

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Desenvolvedora Backend")).toBeInTheDocument();
    expect(screen.getByText("Resumo Profissional")).toBeInTheDocument();
    expect(screen.getByText("Experiência Profissional")).toBeInTheDocument();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
    expect(screen.getByText("Habilidades Técnicas")).toBeInTheDocument();
    expect(screen.getByText("Formação Acadêmica")).toBeInTheDocument();
    expect(screen.getByText("Idiomas")).toBeInTheDocument();

    expect(screen.getByText(/Personalizado para: Backend/)).toBeInTheDocument();
    expect(screen.getByText("92")).toBeInTheDocument();
    expect(screen.getByText("Aprovado para ATS")).toBeInTheDocument();
    expect(screen.getByText("node.js")).toBeInTheDocument();
    expect(screen.getByText("kubernetes")).toBeInTheDocument();
    expect(screen.getByText(/Adicione mais resultados/)).toBeInTheDocument();
    expect(screen.getByText(/GitHub import parcial/)).toBeInTheDocument();
    // fonte desconhecida cai no fallback (mostra o próprio código)
    expect(screen.getByText("outra")).toBeInTheDocument();
  });

  it("lida com uma análise vazia (sem seções, score baixo)", () => {
    render(<ResumePreview analysis={emptyAnalysis()} />);

    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Dados insuficientes")).toBeInTheDocument();
    expect(screen.queryByText("Resumo Profissional")).not.toBeInTheDocument();
    expect(screen.queryByText("Experiência Profissional")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos")).not.toBeInTheDocument();
    expect(screen.queryByText(/Personalizado para/)).not.toBeInTheDocument();
  });

  it("renderiza experiência/projeto sem cargo, período, stack ou descrição", () => {
    const a = fullAnalysis();
    a.resume.experience = [
      // só com período (stack vazio) -> cobre o ramo "sem stack"
      { empresa: "Acme", cargo: "", periodo: "2020", stack: "", atividades: ["Fiz algo"], resultados: [] },
      // totalmente vazia -> cobre o ramo sem período nem stack
      { empresa: "Beta", cargo: "", periodo: "", stack: "", atividades: ["Outro"], resultados: [] },
    ];
    a.resume.projects = [{ name: "Projeto X", stack: "", description: "", highlights: ["Destaque"] }];
    render(<ResumePreview analysis={a} />);

    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("Projeto X")).toBeInTheDocument();
    expect(screen.getByText("Destaque")).toBeInTheDocument();
  });

  it("usa a cor âmbar para score intermediário", () => {
    render(
      <ResumePreview
        analysis={fullAnalysis({
          atsReport: { ...fullAnalysis().atsReport, score: 60, status: "NEEDS_IMPROVEMENT" },
        })}
      />,
    );
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("Pode melhorar")).toBeInTheDocument();
  });
});
