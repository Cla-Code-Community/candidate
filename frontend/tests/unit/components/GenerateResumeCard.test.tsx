import { GenerateResumeCard } from "@/domains/new_dashboard/components/profile/GenerateResumeCard";
import { ApiError, type ApiErrorCode } from "@/shared/lib/apiError";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renderResume = vi.hoisted(() => vi.fn());
const analyzeResume = vi.hoisted(() => vi.fn());

vi.mock("@/domains/new_dashboard/infrastructure/resumeApi", () => ({
  renderResume,
  analyzeResume,
}));

vi.mock("@/domains/new_dashboard/components/profile/ResumePreview", () => ({
  ResumePreview: () => <div data-testid="resume-preview" />,
}));

describe("GenerateResumeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeResume.mockResolvedValue({
      resume: { name: "Ana" },
      atsReport: { score: 80 },
      warnings: [],
      sourcesUsed: [],
      job: {},
    });
    renderResume.mockResolvedValue({ atsScore: 80, filename: "curriculo.pdf" });
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
    renderResume.mockResolvedValueOnce({
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
    renderResume.mockResolvedValueOnce({ atsScore: null, filename: "x.docx" });

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
      expect(analyzeResume).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTitle: "Backend Dev",
          jobDescription: "Node.js e TypeScript",
          githubUrl: "https://github.com/ana",
          linkedinUrl: "https://www.linkedin.com/in/ana",
          about: "Engenheira backend focada em APIs.",
        }),
      );
    });
    expect(renderResume).toHaveBeenCalledWith(
      expect.objectContaining({ format: "docx" }),
    );
  });

  it("exibe mensagem de erro quando a geração falha (erro genérico)", async () => {
    analyzeResume.mockRejectedValueOnce(new Error("boom"));

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
    renderResume.mockResolvedValueOnce({ atsScore: score, filename: "cv.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it("sucesso sem ATS Score não mostra a pontuação, mas mostra o arquivo", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: null, filename: "sem_score.pdf" });

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
    ["VALIDATION_ERROR", /^x$/],
    ["NOT_FOUND", /perfil não encontrado/i],
    ["INTERNAL_ERROR", /indisponível/i],
    ["UNKNOWN_ERROR", /tente novamente/i],
  ])("mapeia o erro de API %s para mensagem amigável", async (code, matcher) => {
    analyzeResume.mockRejectedValueOnce(new ApiError(code, "x", 400));

    render(<GenerateResumeCard />);
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(matcher)).toBeInTheDocument();
    });
  });

  it("adiciona, edita, filtra e remove experiências profissionais", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 80, filename: "x.pdf" });

    render(<GenerateResumeCard />);

    const addButton = screen.getByRole("button", { name: /adicionar experiência/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const companies = screen.getAllByPlaceholderText("Empresa");
    const roles = screen.getAllByPlaceholderText("Cargo");
    const starts = screen.getAllByLabelText("Data de início");
    const ends = screen.getAllByLabelText("Data de término");
    const descriptions = screen.getAllByPlaceholderText(/atividades e resultados/i);
    expect(companies).toHaveLength(2);

    // 1ª experiência completa
    fireEvent.change(companies[0], { target: { value: "Empresa A" } });
    fireEvent.change(roles[0], { target: { value: "Engenheiro" } });
    fireEvent.change(starts[0], { target: { value: "2021-03-01" } });
    fireEvent.change(ends[0], { target: { value: "2023-06-01" } });
    fireEvent.change(descriptions[0], { target: { value: "Fiz APIs" } });

    // 2ª experiência incompleta (só empresa) -> deve ser filtrada
    fireEvent.change(companies[1], { target: { value: "Empresa Incompleta" } });

    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => {
      expect(analyzeResume).toHaveBeenCalledTimes(1);
    });
    const call = analyzeResume.mock.calls[0][0];
    expect(call.experiences).toEqual([
      {
        company: "Empresa A",
        role: "Engenheiro",
        startDate: "2021-03-01",
        endDate: "2023-06-01",
        current: undefined,
        description: "Fiz APIs",
      },
    ]);
  });

  it("envia experiência só com empresa+cargo (datas/descrição viram undefined)", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 80, filename: "z.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar experiência/i }));
    fireEvent.change(screen.getByPlaceholderText("Empresa"), {
      target: { value: "Empresa A" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cargo"), {
      target: { value: "Dev" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(analyzeResume).toHaveBeenCalledTimes(1));
    expect(analyzeResume.mock.calls[0][0].experiences).toEqual([
      {
        company: "Empresa A",
        role: "Dev",
        startDate: undefined,
        endDate: undefined,
        current: undefined,
        description: undefined,
      },
    ]);
  });

  it("marca trabalho atual e omite a data de término", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 80, filename: "c.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar experiência/i }));
    fireEvent.change(screen.getByPlaceholderText("Empresa"), {
      target: { value: "Empresa Atual" },
    });
    fireEvent.change(screen.getByPlaceholderText("Cargo"), {
      target: { value: "Engenheiro" },
    });
    fireEvent.change(screen.getByLabelText("Data de início"), {
      target: { value: "2022-01-01" },
    });
    fireEvent.click(screen.getByLabelText(/trabalho atual/i));
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(analyzeResume).toHaveBeenCalledTimes(1));
    expect(analyzeResume.mock.calls[0][0].experiences).toEqual([
      {
        company: "Empresa Atual",
        role: "Engenheiro",
        startDate: "2022-01-01",
        endDate: undefined,
        current: true,
        description: undefined,
      },
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
    fireEvent.click(screen.getByRole("button", { name: /adicionar experiência/i }));
    expect(screen.getAllByPlaceholderText("Empresa")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /remover experiência/i }));
    expect(screen.queryByPlaceholderText("Empresa")).not.toBeInTheDocument();
  });

  it("não envia experiences quando nenhuma está completa", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 70, filename: "y.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar experiência/i }));
    // deixa a experiência vazia (sem empresa/cargo)
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(analyzeResume).toHaveBeenCalledTimes(1));
    expect(analyzeResume.mock.calls[0][0].experiences).toBeUndefined();
  });

  it("adiciona formação acadêmica com datas e envia no payload", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 80, filename: "f.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar formação/i }));
    fireEvent.change(screen.getByPlaceholderText("Instituição"), {
      target: { value: "USP" },
    });
    fireEvent.change(screen.getByPlaceholderText(/grau/i), {
      target: { value: "Bacharelado" },
    });
    fireEvent.change(screen.getByPlaceholderText(/curso \/ área/i), {
      target: { value: "Ciência da Computação" },
    });
    fireEvent.change(screen.getByLabelText("Data de início"), {
      target: { value: "2016-02-01" },
    });
    fireEvent.change(screen.getByLabelText("Data de término"), {
      target: { value: "2020-12-01" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(analyzeResume).toHaveBeenCalledTimes(1));
    expect(analyzeResume.mock.calls[0][0].education).toEqual([
      {
        institution: "USP",
        degree: "Bacharelado",
        field: "Ciência da Computação",
        startDate: "2016-02-01",
        endDate: "2020-12-01",
        current: undefined,
      },
    ]);
  });

  it("não envia education quando nenhuma formação tem instituição", async () => {
    renderResume.mockResolvedValueOnce({ atsScore: 70, filename: "g.pdf" });

    render(<GenerateResumeCard />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar formação/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /gerar e baixar/i }),
    );

    await waitFor(() => expect(analyzeResume).toHaveBeenCalledTimes(1));
    expect(analyzeResume.mock.calls[0][0].education).toBeUndefined();
  });
});
