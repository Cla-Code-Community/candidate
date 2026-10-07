import { GenerateResumeCard } from "@/domains/new_dashboard/components/profile/GenerateResumeCard";
import { ApiError, type ApiErrorCode } from "@/shared/lib/apiError";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateResume = vi.hoisted(() => vi.fn());
const analyzeResume = vi.hoisted(() => vi.fn());

vi.mock("@/domains/new_dashboard/infrastructure/resumeApi", () => ({
  generateResume,
  analyzeResume,
}));

vi.mock("@/domains/new_dashboard/components/profile/ResumePreview", () => ({
  ResumePreview: () => <div data-testid="resume-preview" />,
}));

describe("GenerateResumeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza título, botão e campos de GitHub/LinkedIn", () => {
    render(<GenerateResumeCard />);

    expect(
      screen.getByRole("heading", { name: /gerar currículo via ats-forge/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/github\.com\/seu-usuario/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/linkedin\.com\/in\/seu-perfil/i),
    ).toBeInTheDocument();
  });

  it("gera o currículo e exibe o ATS Score no sucesso", async () => {
    generateResume.mockResolvedValueOnce({
      atsScore: 87,
      filename: "Ana_Souza.pdf",
    });

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/ATS Score:/i)).toBeInTheDocument();
    });
    expect(screen.getByText("87/100")).toBeInTheDocument();
    expect(screen.getByText("Ana_Souza.pdf")).toBeInTheDocument();
  });

  it("envia formato, vaga e links de GitHub/LinkedIn", async () => {
    generateResume.mockResolvedValueOnce({ atsScore: null, filename: "x.docx" });

    render(<GenerateResumeCard />);

    fireEvent.change(screen.getByPlaceholderText(/desenvolvedor backend/i), {
      target: { value: "Backend Dev" },
    });
    fireEvent.change(screen.getByPlaceholderText(/cole aqui a descrição/i), {
      target: { value: "Node.js e TypeScript" },
    });
    fireEvent.change(screen.getByPlaceholderText(/github\.com\/seu-usuario/i), {
      target: { value: "https://github.com/ana" },
    });
    fireEvent.change(screen.getByPlaceholderText(/linkedin\.com\/in\/seu-perfil/i), {
      target: { value: "https://www.linkedin.com/in/ana" },
    });
    fireEvent.change(screen.getByPlaceholderText(/cole aqui o texto da seção 'sobre'/i), {
      target: { value: "Engenheira backend focada em APIs." },
    });
    fireEvent.change(screen.getByDisplayValue("PDF"), {
      target: { value: "docx" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(generateResume).toHaveBeenCalledWith({
        format: "docx",
        jobTitle: "Backend Dev",
        jobDescription: "Node.js e TypeScript",
        githubUrl: "https://github.com/ana",
        linkedinUrl: "https://www.linkedin.com/in/ana",
        about: "Engenheira backend focada em APIs.",
      });
    });
  });

  it("exibe mensagem de erro quando a geração falha (erro genérico)", async () => {
    generateResume.mockRejectedValueOnce(new Error("boom"));

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/não foi possível gerar o currículo/i),
      ).toBeInTheDocument();
    });
  });

  it.each([
    [30, "30/100"],
    [60, "60/100"],
    [90, "90/100"],
  ])("exibe o ATS Score %i com a cor correspondente", async (score, label) => {
    generateResume.mockResolvedValueOnce({ atsScore: score, filename: "cv.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("sucesso sem ATS Score não mostra a pontuação, mas mostra o arquivo", async () => {
    generateResume.mockResolvedValueOnce({ atsScore: null, filename: "sem_score.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("sem_score.pdf")).toBeInTheDocument();
    });
    expect(screen.queryByText(/ATS Score:/i)).not.toBeInTheDocument();
  });

  it.each<[ApiErrorCode, RegExp]>([
    ["UNAUTHORIZED", /sessão expirou/i],
    ["VALIDATION_ERROR", /dados suficientes/i],
    ["NOT_FOUND", /perfil não encontrado/i],
    ["INTERNAL_ERROR", /indisponível/i],
    ["UNKNOWN_ERROR", /tente novamente/i],
  ])("mapeia o erro de API %s para mensagem amigável", async (code, matcher) => {
    generateResume.mockRejectedValueOnce(new ApiError(code, "x", 400));

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(matcher)).toBeInTheDocument();
    });
  });

  it("adiciona, edita, filtra e remove experiências profissionais", async () => {
    generateResume.mockResolvedValueOnce({ atsScore: 80, filename: "x.pdf" });

    render(<GenerateResumeCard />);

    const addButton = screen.getByRole("button", { name: /adicionar/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const companies = screen.getAllByPlaceholderText("Empresa");
    const roles = screen.getAllByPlaceholderText("Cargo");
    const periods = screen.getAllByPlaceholderText(/período/i);
    const descriptions = screen.getAllByPlaceholderText(/atividades e resultados/i);
    expect(companies).toHaveLength(2);

    // 1ª experiência completa
    fireEvent.change(companies[0], { target: { value: "Empresa A" } });
    fireEvent.change(roles[0], { target: { value: "Engenheiro" } });
    fireEvent.change(periods[0], { target: { value: "2023 - Atual" } });
    fireEvent.change(descriptions[0], { target: { value: "Fiz APIs" } });

    // 2ª experiência incompleta (só empresa) -> deve ser filtrada
    fireEvent.change(companies[1], { target: { value: "Empresa Incompleta" } });

    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(generateResume).toHaveBeenCalledTimes(1);
    });
    const call = generateResume.mock.calls[0][0];
    expect(call.experiences).toEqual([
      {
        company: "Empresa A",
        role: "Engenheiro",
        period: "2023 - Atual",
        description: "Fiz APIs",
      },
    ]);
  });

  it("envia experiência só com empresa+cargo (período/descrição viram undefined)", async () => {
    generateResume.mockResolvedValueOnce({ atsScore: 80, filename: "z.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.change(screen.getByPlaceholderText("Empresa"), {
      target: { value: "Empresa A" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cargo"), {
      target: { value: "Dev" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(generateResume).toHaveBeenCalledTimes(1));
    expect(generateResume.mock.calls[0][0].experiences).toEqual([
      { company: "Empresa A", role: "Dev", period: undefined, description: undefined },
    ]);
  });

  it("pré-visualiza o currículo (analyze) e mostra o preview", async () => {
    analyzeResume.mockResolvedValueOnce({ resume: {}, atsReport: {} });

    render(<GenerateResumeCard />);
    fireEvent.change(screen.getByPlaceholderText(/github\.com\/seu-usuario/i), {
      target: { value: "https://github.com/ana" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pré-visualizar/i }));

    await waitFor(() => {
      expect(screen.getByTestId("resume-preview")).toBeInTheDocument();
    });
    expect(analyzeResume).toHaveBeenCalledWith(
      expect.objectContaining({ githubUrl: "https://github.com/ana" }),
    );
  });

  it("mostra erro quando a pré-visualização falha", async () => {
    analyzeResume.mockRejectedValueOnce(new Error("boom"));

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /pré-visualizar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/não foi possível gerar o currículo/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByTestId("resume-preview")).not.toBeInTheDocument();
  });

  it("remove uma experiência adicionada", () => {
    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    expect(screen.getAllByPlaceholderText("Empresa")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /remover experiência/i }));
    expect(screen.queryByPlaceholderText("Empresa")).not.toBeInTheDocument();
  });

  it("não envia experiences quando nenhuma está completa", async () => {
    generateResume.mockResolvedValueOnce({ atsScore: 70, filename: "y.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    // deixa a experiência vazia (sem empresa/cargo)
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(generateResume).toHaveBeenCalledTimes(1));
    expect(generateResume.mock.calls[0][0].experiences).toBeUndefined();
  });
});
