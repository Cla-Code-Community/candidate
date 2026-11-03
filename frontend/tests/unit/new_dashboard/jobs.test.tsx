import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddJobModal } from "@/features/applications/components/AddJobModal";
import { JobDetailModal } from "@/features/jobs/components/JobDetailModal";
import { JobFilter } from "@/features/jobs/components/JobFilter";
import { FormattedJobDescription } from "@/features/jobs/components/FormattedJobDescription";
import { JobRow } from "@/features/jobs/components/JobRow";
import { JobTab } from "@/features/jobs/components/JobTab";
import { JobTable } from "@/features/jobs/components/JobTable";
import { initialPreferences } from "@/features/profile/defaults";
import type { Job, JobModelFilter } from "@/features/jobs/domain/job";
import type {
  ContinentFilter,
  CountryFilter,
} from "@/features/jobs/domain/locationFilters";

const dashboardApiMock = vi.hoisted(() => ({
  getDashboardSavedJobEvents: vi.fn(),
  getDashboardApplicationNotes: vi.fn(),
  createDashboardApplicationNote: vi.fn(),
  updateDashboardApplicationNote: vi.fn(),
  deleteDashboardApplicationNote: vi.fn(),
}));

vi.mock("@/features/jobs/api/dashboardJobsApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/jobs/api/dashboardJobsApi")>(),
  getDashboardSavedJobEvents: dashboardApiMock.getDashboardSavedJobEvents,
  getDashboardApplicationNotes: dashboardApiMock.getDashboardApplicationNotes,
  createDashboardApplicationNote: dashboardApiMock.createDashboardApplicationNote,
  updateDashboardApplicationNote: dashboardApiMock.updateDashboardApplicationNote,
  deleteDashboardApplicationNote: dashboardApiMock.deleteDashboardApplicationNote,
}));

const baseJob: Job = {
  id: "job-1",
  jobTitle: "Frontend Developer",
  company: "ACME",
  location: "São Paulo, Brasil",
  salary: "R$ 10.000",
  type: "Híbrido",
  level: "Pleno",
  matchScore: 88,
  tags: ["React", "TypeScript"],
  posted: "Hoje",
  status: "saved",
  jobLink: "https://example.com/job-1",
  source: "LinkedIn",
  notes: "Nota inicial",
  rawPayload: {
    description: "Descrição completa da vaga",
    url: "https://example.com/job-1",
  },
};

function makeJobs(count: number): Job[] {
  return Array.from({ length: count }, (_, index) => ({
    ...baseJob,
    id: `job-${index + 1}`,
    jobTitle: `Job ${index + 1}`,
    company: `Company ${index + 1}`,
    posted: `Dia ${index + 1}`,
    jobLink: `https://example.com/job-${index + 1}`,
  }));
}

describe("new_dashboard job components", () => {
  beforeEach(() => {
    dashboardApiMock.getDashboardSavedJobEvents.mockReset();
    dashboardApiMock.getDashboardApplicationNotes.mockReset();
    dashboardApiMock.createDashboardApplicationNote.mockReset();
    dashboardApiMock.updateDashboardApplicationNote.mockReset();
    dashboardApiMock.deleteDashboardApplicationNote.mockReset();
    dashboardApiMock.getDashboardApplicationNotes.mockResolvedValue([]);
  });

  it("cria, edita e remove notas privadas no detalhe da candidatura", async () => {
    dashboardApiMock.createDashboardApplicationNote.mockResolvedValue({
      id: "note-1", content: "Preparar portfólio", createdAt: "2026-01-01", updatedAt: "2026-01-01",
    });
    dashboardApiMock.updateDashboardApplicationNote.mockResolvedValue({
      id: "note-1", content: "Portfólio enviado", createdAt: "2026-01-01", updatedAt: "2026-01-02",
    });

    render(<JobDetailModal job={baseJob} isTracked onClose={vi.fn()} onStatusChange={vi.fn()} />);
    await screen.findByText("Nenhuma nota adicionada.");
    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "Preparar portfólio" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar nota" }));
    await screen.findByText("Preparar portfólio");
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nova nota"), { target: { value: "Portfólio enviado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await screen.findByText("Portfólio enviado");
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(dashboardApiMock.deleteDashboardApplicationNote).toHaveBeenCalledWith("job-1", "note-1"));
  });

  it("exibe a timeline em ordem cronológica e atualiza após mudar o status", async () => {
    dashboardApiMock.getDashboardSavedJobEvents
      .mockResolvedValueOnce([
        {
          id: "event-2",
          type: "status_changed",
          fromStatus: "applied",
          toStatus: "interviewing",
          metadata: null,
          createdAt: "2026-07-11T12:00:00.000Z",
        },
        {
          id: "event-1",
          type: "status_changed",
          fromStatus: "saved",
          toStatus: "applied",
          metadata: { source: "dashboard" },
          createdAt: "2026-07-10T12:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "event-3",
          type: "status_changed",
          fromStatus: "interviewing",
          toStatus: "accepted",
          metadata: null,
          createdAt: "2026-07-12T12:00:00.000Z",
        },
      ]);

    const view = render(
      <JobDetailModal
        job={baseJob}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
        isTracked
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/status alterado de salva para candidatura enviada/i),
      ).toBeInTheDocument();
    });

    const entries = screen.getAllByRole("listitem");
    expect(entries[0]).toHaveTextContent(/salva para candidatura enviada/i);
    expect(entries[1]).toHaveTextContent(
      /candidatura enviada para em entrevista/i,
    );
    expect(entries[0]).toHaveTextContent("Fonte: dashboard");

    view.rerender(
      <JobDetailModal
        job={{ ...baseJob, status: "accepted" }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
        isTracked
        timelineVersion={1}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/em entrevista para proposta aceita/i),
      ).toBeInTheDocument();
    });
    expect(dashboardApiMock.getDashboardSavedJobEvents).toHaveBeenCalledTimes(2);
  });

  it("mostra estados vazio e de erro da timeline", async () => {
    dashboardApiMock.getDashboardSavedJobEvents.mockResolvedValueOnce([]);
    const view = render(
      <JobDetailModal
        job={baseJob}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
        isTracked
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/nenhuma mudança de status registrada/i)).toBeInTheDocument();
    });

    dashboardApiMock.getDashboardSavedJobEvents.mockRejectedValueOnce(
      new Error("falha"),
    );
    view.rerender(
      <JobDetailModal
        job={baseJob}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
        isTracked
        timelineVersion={1}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/não foi possível carregar o histórico/i)).toBeInTheDocument();
    });
  });

  it("atualiza os filtros da busca", () => {
    const setSearchQuery = vi.fn();
    const setFilterType = vi.fn();
    const setFilterLevel = vi.fn();
    const setContinentFilter = vi.fn();
    const setCountryFilter = vi.fn();
    const setStateFilter = vi.fn();
    const setCityFilter = vi.fn();
    const setSelectedFamilies = vi.fn();

    render(
      <JobFilter
        searchQuery=""
        setSearchQuery={setSearchQuery}
        filterType="Todos"
        setFilterType={setFilterType}
        filterLevel="Todos"
        setFilterLevel={setFilterLevel}
        continentFilter={"Todos" as ContinentFilter}
        setContinentFilter={setContinentFilter}
        countryFilter={"Todos" as CountryFilter}
        setCountryFilter={setCountryFilter}
        stateFilter=""
        setStateFilter={setStateFilter}
        cityFilter=""
        setCityFilter={setCityFilter}
        selectedFamilies={[]}
        setSelectedFamilies={setSelectedFamilies}
        familyOptions={[{ id: "dev", label: "Desenvolvimento" }]}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /buscar por cargo, empresa ou keywords/i,
    );
    expect(searchInput).toHaveAttribute("maxlength", "100");
    const professionalFilters = within(screen.getByRole("group", { name: "Filtros profissionais" }));
    const locationFilters = within(screen.getByRole("group", { name: "Localização" }));
    expect(professionalFilters.getByRole("textbox", { name: "Buscar vagas" })).toBe(searchInput);
    expect(professionalFilters.getByRole("combobox", { name: "Modalidade" })).toBeInTheDocument();
    expect(professionalFilters.getByRole("combobox", { name: "Senioridade" })).toBeInTheDocument();
    expect(locationFilters.getByRole("combobox", { name: "Continente" })).toBeInTheDocument();
    expect(locationFilters.getByRole("combobox", { name: "País" })).toBeInTheDocument();
    expect(locationFilters.getByRole("textbox", { name: "Estado / Região" })).toBeInTheDocument();
    expect(locationFilters.getByRole("textbox", { name: "Cidade" })).toBeInTheDocument();
    expect(locationFilters.queryByRole("combobox", { name: "Ordenação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Ordenação" })).not.toBeInTheDocument();

    fireEvent.change(searchInput, {
      target: { value: "react" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /filtrar por área profissional/i }),
    );
    fireEvent.click(screen.getByText("Desenvolvimento"));

    fireEvent.change(screen.getByRole("combobox", { name: "Senioridade" }), {
      target: { value: "Sênior" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Modalidade" }), {
      target: { value: "Remoto" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Continente" }), {
      target: { value: "Europa" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "País" }), {
      target: { value: "Portugal" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Estado / Região" }), { target: { value: "SC" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Cidade" }), { target: { value: "Joinville" } });

    expect(setSearchQuery).toHaveBeenCalledWith("react");
    expect(setSelectedFamilies).toHaveBeenCalledWith(["dev"]);
    expect(setFilterLevel).toHaveBeenCalledWith("Sênior");
    expect(setFilterType).toHaveBeenCalledWith("Remoto");
    expect(setContinentFilter).toHaveBeenCalledWith("Europa");
    expect(setCountryFilter).toHaveBeenCalledWith("Portugal");
    expect(setStateFilter).toHaveBeenCalledWith("SC");
    expect(setCityFilter).toHaveBeenCalledWith("Joinville");
  });

  it("mantém seleção múltipla, tags removíveis, limpeza e fechamento do dropdown", () => {
    function FiltersHarness() {
      const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
      return (
        <JobFilter
          searchQuery=""
          setSearchQuery={() => {}}
          filterType="Todos"
          setFilterType={() => {}}
          filterLevel="Todos"
          setFilterLevel={() => {}}
          continentFilter="Todos"
          setContinentFilter={() => {}}
          countryFilter="Todos"
          setCountryFilter={() => {}}
          stateFilter=""
          setStateFilter={() => {}}
          cityFilter=""
          setCityFilter={() => {}}
          selectedFamilies={selectedFamilies}
          setSelectedFamilies={setSelectedFamilies}
          familyOptions={[
            { id: "backend", label: "Backend" },
            { id: "frontend", label: "Frontend" },
          ]}
        />
      );
    }
    render(<FiltersHarness />);
    const trigger = screen.getByRole("button", {
      name: "Filtrar por área profissional",
    });
    fireEvent.click(trigger);
    const dropdown = screen.getByRole("group", {
      name: "Áreas profissionais disponíveis",
    });
    expect(trigger).toHaveAttribute("aria-controls", dropdown.id);
    fireEvent.click(within(dropdown).getByRole("checkbox", { name: "Backend" }));
    fireEvent.click(within(dropdown).getByRole("checkbox", { name: "Frontend" }));
    expect(trigger).toHaveTextContent("2 áreas selecionadas");
    expect(
      within(dropdown)
        .getAllByRole("checkbox")
        .filter((checkbox) => (checkbox as HTMLInputElement).checked),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remover área Backend" }));
    expect(
      within(dropdown).getByRole("checkbox", { name: "Backend" }),
    ).not.toBeChecked();
    expect(
      within(dropdown).getByRole("checkbox", { name: "Frontend" }),
    ).toBeChecked();
    fireEvent.click(within(dropdown).getByRole("button", { name: "Limpar" }));
    expect(
      within(dropdown)
        .getAllByRole("checkbox")
        .every((checkbox) => !(checkbox as HTMLInputElement).checked),
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: /Remover área/ }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(dropdown, { key: "Escape" });
    expect(
      screen.queryByRole("group", { name: "Áreas profissionais disponíveis" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renderiza a tabela vazia e paginação local e remota", () => {
    const localRender = render(
      <JobTable jobs={[]} onOpenJob={vi.fn()} onStatusChange={vi.fn()} />,
    );

    expect(screen.getByText(/nenhuma vaga encontrada/i)).toBeInTheDocument();

    localRender.unmount();

    const paginatedRender = render(
      <JobTable
        jobs={makeJobs(12)}
        onOpenJob={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/exibindo 1-10 de 12 vagas/i)).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Cargo / empresa / área" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /publicada em/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /próxima página/i }));
    expect(screen.getByText(/exibindo 11-12 de 12 vagas/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/vagas por página/i), {
      target: { value: "20" },
    });
    expect(screen.getByText(/exibindo 1-12 de 12 vagas/i)).toBeInTheDocument();

    paginatedRender.unmount();

    const onPageChange = vi.fn();
    render(
      <JobTable
        jobs={makeJobs(3)}
        onOpenJob={vi.fn()}
        onStatusChange={vi.fn()}
        pagination={{
          total: 30,
          page: 2,
          limit: 10,
          totalPages: 3,
        }}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/exibindo 11-13 de 30 vagas/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /próxima página/i }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renderiza a linha de vaga e aciona detalhes/salvar", () => {
    const onOpen = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <JobRow job={baseJob} onOpen={onOpen} onStatusChange={onStatusChange} />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /detalhes/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(baseJob);
    expect(onStatusChange).toHaveBeenCalledWith(baseJob.id, "saved");
  });

  it("apresenta área, tecnologias e localização sem fabricar dados ausentes", () => {
    const job: Job = { ...baseJob, rawPayload: { classification: { primaryFamily: "backend", technologies: ["Go", "PostgreSQL"] } } };
    const view = render(<table><tbody><JobRow job={job} onOpen={() => {}} onStatusChange={() => {}} /></tbody></table>);
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
    expect(screen.getByText(baseJob.location)).toBeInTheDocument();
    expect(screen.getByText("88%")).toHaveClass("bg-primary/10", "border-primary/25");
    expect(screen.queryByText("América do Sul")).not.toBeInTheDocument();
    view.rerender(<table><tbody><JobRow job={{ ...baseJob, tags: ["Geral"], rawPayload: undefined }} onOpen={() => {}} onStatusChange={() => {}} /></tbody></table>);
    expect(screen.queryByLabelText("Tecnologias e palavras-chave")).not.toBeInTheDocument();
    expect(screen.queryByText("Backend")).not.toBeInTheDocument();
    expect(screen.getByText(baseJob.location)).toBeInTheDocument();
  });

  it("ordena Match antes da paginação local e trata valores nulos como zero", () => {
    const jobs = Array.from({ length: 12 }, (_, index) => ({ ...baseJob, id: `match-${index}`, jobTitle: `Match ${index}`, matchScore: index === 11 ? 100 : index }));
    jobs[0].matchScore = null as unknown as number;
    jobs[1].matchScore = undefined as unknown as number;
    render(<JobTable jobs={jobs} onOpenJob={() => {}} onStatusChange={() => {}} />);
    const titles = () => screen.getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell")[0].querySelector("button")?.textContent);
    expect(titles()[0]).toBe("Match 0ACME");
    const trigger = screen.getByRole("button", { name: "Ordenar por match" });
    fireEvent.click(trigger);
    expect(screen.getByRole("columnheader", { name: "Match" })).toHaveAttribute("aria-sort", "descending");
    expect(titles()[0]).toBe("Match 11ACME");
    fireEvent.click(trigger);
    expect(screen.getByRole("columnheader", { name: "Match" })).toHaveAttribute("aria-sort", "ascending");
    expect(titles().slice(0, 3)).toEqual(["Match 0ACME", "Match 1ACME", "Match 2ACME"]);
  });

  it("delega Match à API sem reordenar a página recebida e mantém o estado na paginação", () => {
    const directions: string[] = [];
    const onPageChange = vi.fn();
    function RemoteTable() {
      const [matchSort, setMatchSort] = useState<"default" | "asc" | "desc">("default");
      return <JobTable jobs={[{ ...baseJob, id: "low", jobTitle: "Menor", matchScore: 10 }, { ...baseJob, id: "high", jobTitle: "Maior", matchScore: 90 }]} matchSort={matchSort} onMatchSortChange={value => { directions.push(value); setMatchSort(value); }} pagination={{ total: 100, page: 2, limit: 2, totalPages: 50 }} onPageChange={onPageChange} onOpenJob={() => {}} onStatusChange={() => {}} />;
    }
    render(<RemoteTable />);
    const trigger = screen.getByRole("button", { name: "Ordenar por match" });
    expect(screen.getByRole("columnheader", { name: "Match" })).toHaveAttribute("aria-sort", "none");
    fireEvent.click(trigger);
    expect(directions).toEqual(["desc"]);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Menor");
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(screen.getByRole("columnheader", { name: "Match" })).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(trigger);
    expect(directions).toEqual(["desc", "asc"]);
    expect(screen.getByRole("columnheader", { name: "Match" })).toHaveAttribute("aria-sort", "ascending");
  });

  it("desabilita Match paginado quando não há callback de ordenação global", () => {
    render(<JobTable jobs={[baseJob]} pagination={{ total: 20, page: 1, limit: 10, totalPages: 2 }} onOpenJob={() => {}} onStatusChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Ordenar por match" })).toBeDisabled();
  });

  it("ordena a tabela por fonte, nível e data de publicação", () => {
    const jobs: Job[] = [
      {
        ...baseJob,
        id: "linkedin-senior",
        jobTitle: "Vaga LinkedIn",
        source: "LinkedIn",
        level: "Sênior",
        posted: "10/07/2026",
        rawPayload: { postedAt: "2026-07-10T12:00:00Z" },
      },
      {
        ...baseJob,
        id: "adzuna-junior",
        jobTitle: "Vaga Adzuna",
        source: "Adzuna",
        level: "Júnior",
        posted: "25/07/2026",
        rawPayload: { postedAt: "2026-07-25T12:00:00Z" },
      },
      {
        ...baseJob,
        id: "greenhouse-pleno",
        jobTitle: "Vaga Greenhouse",
        source: "Greenhouse",
        level: "Pleno",
        posted: "Não informado",
        rawPayload: {},
      },
    ];

    render(
      <JobTable jobs={jobs} onOpenJob={vi.fn()} onStatusChange={vi.fn()} />,
    );

    const visibleTitles = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getAllByRole("cell")[0].querySelector("button")?.textContent);

    fireEvent.click(screen.getByRole("button", { name: /ordenar por fonte/i }));
    expect(screen.getByRole("button", { name: /ordenar por fonte/i })).toHaveClass("text-primary");
    expect(screen.getByRole("button", { name: /ordenar por nível/i })).not.toHaveClass("text-primary");
    expect(visibleTitles()).toEqual([
      "Vaga AdzunaACME",
      "Vaga GreenhouseACME",
      "Vaga LinkedInACME",
    ]);
    expect(
      screen.getByRole("columnheader", { name: /^fonte$/i }),
    ).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /ordenar por nível/i }));
    expect(screen.getByRole("button", { name: /ordenar por nível/i })).toHaveClass("text-primary");
    expect(screen.getByRole("button", { name: /ordenar por fonte/i })).not.toHaveClass("text-primary");
    expect(visibleTitles()).toEqual([
      "Vaga AdzunaACME",
      "Vaga GreenhouseACME",
      "Vaga LinkedInACME",
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: /ordenar por data de publicação/i }),
    );
    expect(visibleTitles()).toEqual([
      "Vaga AdzunaACME",
      "Vaga LinkedInACME",
      "Vaga GreenhouseACME",
    ]);
  });

  it("mostra detalhes completos da vaga e atualiza status/notas", () => {
    const onClose = vi.fn();
    const onStatusChange = vi.fn();
    const onNotesChange = vi.fn();

    render(
      <JobDetailModal
        job={baseJob}
        onClose={onClose}
        onStatusChange={onStatusChange}
        onNotesChange={onNotesChange}
      />,
    );

    // PAV-92: "Payload da vaga" virou "Detalhes adicionais" e não duplica
    // mais campos já representados em outro lugar do detalhe. O `url` de
    // baseJob.rawPayload é igual a `jobLink` (já mostrado em "Abrir vaga"),
    // então o bloco não tem nada extra pra mostrar aqui e não renderiza.
    expect(screen.queryByText(/detalhes adicionais/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir vaga/i })).toHaveAttribute(
      "href",
      baseJob.jobLink,
    );

    fireEvent.change(screen.getByLabelText(/^status$/i), {
      target: { value: "interviewing" },
    });
    fireEvent.change(screen.getByLabelText(/^notas$/i), {
      target: { value: "Nova nota" },
    });
    fireEvent.click(screen.getByRole("button", { name: /concluir/i }));

    expect(onStatusChange).toHaveBeenCalledWith(baseJob.id, "interviewing");
    expect(onNotesChange).toHaveBeenCalledWith(baseJob.id, "Nova nota");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renderiza payloads compostos no modal de detalhes", () => {
    render(
      <JobDetailModal
        job={{
          ...baseJob,
          rawPayload: {
            description: "Detalhes avançados da vaga",
            sources: ["LinkedIn", "Gupy"],
            metadata: { seniority: "Pleno" },
            keywords: ["React", "TypeScript"],
          },
        }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
      />,
    );

    expect(screen.getByText("LinkedIn, Gupy")).toBeInTheDocument();
    expect(screen.getByText(/seniority/i)).toBeInTheDocument();
    expect(screen.getByText(/detalhes avançados da vaga/i)).toBeInTheDocument();
  });

  it("formata HTML codificado e descarta conteúdo inseguro da descrição", () => {
    const { container } = render(
      <JobDetailModal
        job={{
          ...baseJob,
          rawPayload: {
            description:
              "&lt;h3&gt;Sobre a vaga&lt;/h3&gt;&lt;p&gt;Crie produtos com &lt;strong&gt;React&lt;/strong&gt;.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;TypeScript&lt;/li&gt;&lt;/ul&gt;&lt;a href=&quot;https://example.com/details&quot;&gt;Saiba mais&lt;/a&gt;&lt;script&gt;alert('xss')&lt;/script&gt;",
          },
        }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Sobre a vaga" }),
    ).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("React");
    expect(screen.getByRole("listitem")).toHaveTextContent("TypeScript");
    expect(screen.getByRole("link", { name: "Saiba mais" })).toHaveAttribute(
      "href",
      "https://example.com/details",
    );
    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.queryByText(/alert\('xss'\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/&lt;h3&gt;/i)).not.toBeInTheDocument();
  });

  it("renderiza texto puro, tags semânticas e links inseguros da descrição", () => {
    const plainRender = render(
      <FormattedJobDescription description={"Linha 1\nLinha 2"} />,
    );

    expect(screen.getByText(/linha 1/i)).toBeInTheDocument();
    expect(screen.getByText(/linha 2/i)).toBeInTheDocument();
    expect(plainRender.container.querySelector("p")).toHaveClass(
      "whitespace-pre-wrap",
    );

    plainRender.unmount();

    const { container } = render(
      <FormattedJobDescription
        description={[
          "<h1>Título principal</h1>",
          "<h2>Subtítulo</h2>",
          "<h4>Grupo</h4>",
          "<blockquote>Citação</blockquote>",
          "<pre><code>npm test</code></pre>",
          "<hr>",
          '<a href="javascript:alert(1)">Link bloqueado</a>',
          '<a href="/vaga">Link relativo seguro</a>',
          "<img src=x onerror=alert(1)>",
          "<div><span>Conteúdo preservado</span></div>",
        ].join("")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Título principal", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Subtítulo", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Grupo", level: 4 }),
    ).toBeInTheDocument();
    expect(container.querySelector("blockquote")).toHaveTextContent("Citação");
    expect(container.querySelector("pre")).toHaveTextContent("npm test");
    expect(container.querySelector("hr")).toBeInTheDocument();
    expect(screen.getByText("Link bloqueado").tagName).toBe("SPAN");
    expect(screen.getByRole("link", { name: "Link relativo seguro" }))
      .toHaveAttribute("href", "http://localhost:3000/vaga");
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Conteúdo preservado")).toBeInTheDocument();
  });

  it("não propaga atributos ativos nem protocolos não permitidos", () => {
    const { container } = render(
      <FormattedJobDescription
        description={[
          '<a href="data:text/html,blocked">Link de dados</a>',
          '<p onclick="alert(1)">Texto seguro</p>',
          '<iframe src="https://example.com"></iframe>',
        ].join("")}
      />,
    );

    expect(screen.getByText("Link de dados").tagName).toBe("SPAN");
    expect(screen.getByText("Texto seguro")).not.toHaveAttribute("onclick");
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("valida e salva uma vaga manual nova", () => {
    const onAddJob = vi.fn();
    const onClose = vi.fn();

    render(<AddJobModal onClose={onClose} onAddJob={onAddJob} />);

    fireEvent.click(screen.getByRole("button", { name: /salvar vaga/i }));
    expect(
      screen.getByText(/informe pelo menos o cargo e a empresa/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/desenvolvedor frontend/i), {
      target: { value: "Backend Developer" },
    });
    fireEvent.change(screen.getByPlaceholderText(/nome da empresa/i), {
      target: { value: "ACME" },
    });
    fireEvent.change(screen.getByPlaceholderText(/remoto, são paulo/i), {
      target: { value: "Lisboa, Portugal" },
    });
    fireEvent.change(screen.getByPlaceholderText(/r\$ 8.000 - r\$ 10.000/i), {
      target: { value: "€ 4.000" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/react, typescript, node.js/i),
      {
        target: { value: "NestJS, PostgreSQL" },
      },
    );
    fireEvent.change(screen.getByPlaceholderText(/linkedin, gupy/i), {
      target: { value: "Gupy" },
    });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/\.\.\./i), {
      target: { value: "https://example.com/new" },
    });
    fireEvent.change(screen.getByPlaceholderText(/próximos passos/i), {
      target: { value: "Observações" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar vaga/i }));

    expect(onAddJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Backend Developer",
        company: "ACME",
        location: "Lisboa, Portugal",
        salary: "€ 4.000",
        tags: "NestJS, PostgreSQL",
        source: "Gupy",
        jobLink: "https://example.com/new",
        notes: "Observações",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("exibe a página recebida no JobTab e dispara busca remota", () => {
    const onSearchJobs = vi.fn();
    const onOpenJob = vi.fn();
    const onStatusChange = vi.fn();

    function Harness() {
      const [searchQuery, setSearchQuery] = useState("");
      const [filterType, setFilterType] = useState<JobModelFilter>("Todos");
      const [filterLevel, setFilterLevel] = useState("Todos");
      const [continentFilter, setContinentFilter] =
        useState<ContinentFilter>("Todos");
      const [countryFilter, setCountryFilter] =
        useState<CountryFilter>("Todos");
      const [stateFilter, setStateFilter] = useState("");
      const [cityFilter, setCityFilter] = useState("");
      const [matchSort, setMatchSort] = useState<"default" | "desc" | "asc">(
        "default",
      );

      return (
        <JobTab
          jobs={[
            {
              ...baseJob,
              id: "remote",
              jobTitle: "Remote React",
              type: "Remoto",
              location: "Worldwide",
            },
            {
              ...baseJob,
              id: "onsite",
              jobTitle: "Onsite Java",
              type: "Presencial",
              location: "São Paulo, Brasil",
            },
          ]}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterType={filterType}
          setFilterType={setFilterType}
          filterLevel={filterLevel}
          setFilterLevel={setFilterLevel}
          continentFilter={continentFilter}
          setContinentFilter={setContinentFilter}
          countryFilter={countryFilter}
          setCountryFilter={setCountryFilter}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
          cityFilter={cityFilter}
          setCityFilter={setCityFilter}
          matchSort={matchSort}
          setMatchSort={setMatchSort}
          selectedFamilies={[]}
          setSelectedFamilies={vi.fn()}
          familyOptions={[]}
          searchPreferences={{ ...initialPreferences, remoteOnly: false }}
          onSearchJobs={onSearchJobs}
          onOpenJob={onOpenJob}
          onStatusChange={onStatusChange}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /buscar vagas/i }));
    expect(onSearchJobs).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Remote React")).toBeInTheDocument();
    expect(screen.getByText("Onsite Java")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Modalidade" }), {
      target: { value: "Remoto" },
    });
    expect(screen.getByText("Remote React")).toBeInTheDocument();
    expect(screen.getByText("Onsite Java")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /detalhes/i })[0]);
    expect(onOpenJob).toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
