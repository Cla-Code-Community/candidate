import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddJobModal } from "@/domains/new_dashboard/components/jobs/AddJobModal";
import { JobDetailModal } from "@/domains/new_dashboard/components/jobs/JobDetailModal";
import { JobFilter } from "@/domains/new_dashboard/components/jobs/JobFilter";
import { JobRow } from "@/domains/new_dashboard/components/jobs/JobRow";
import { JobTab } from "@/domains/new_dashboard/components/jobs/JobTab";
import { JobTable } from "@/domains/new_dashboard/components/jobs/JobTable";
import { initialPreferences } from "@/domains/new_dashboard/constants";
import type { Job } from "@/domains/new_dashboard/types";
import type {
  ContinentFilter,
  CountryFilter,
} from "@/domains/new_dashboard/utils/locationFilters";

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
  it("atualiza os filtros da busca", () => {
    const setSearchQuery = vi.fn();
    const setFilterType = vi.fn();
    const setFilterLevel = vi.fn();
    const setContinentFilter = vi.fn();
    const setCountryFilter = vi.fn();
    const setMatchSort = vi.fn();

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
        matchSort="default"
        setMatchSort={setMatchSort}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/buscar por cargo, empresa ou keywords/i),
      {
        target: { value: "react" },
      },
    );
    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Remoto" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "Sênior" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[2], {
      target: { value: "Europa" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[3], {
      target: { value: "Portugal" },
    });
    fireEvent.change(screen.getAllByRole("combobox")[4], {
      target: { value: "desc" },
    });

    expect(setSearchQuery).toHaveBeenCalledWith("react");
    expect(setFilterType).toHaveBeenCalledWith("Remoto");
    expect(setFilterLevel).toHaveBeenCalledWith("Sênior");
    expect(setContinentFilter).toHaveBeenCalledWith("Europa");
    expect(setCountryFilter).toHaveBeenCalledWith("Portugal");
    expect(setMatchSort).toHaveBeenCalledWith("desc");
  });

  it("renderiza a tabela vazia e paginação local e remota", () => {
    const localRender = render(
      <JobTable
        jobs={[]}
        onOpenJob={vi.fn()}
        onStatusChange={vi.fn()}
      />,
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
          hasNext: true,
          hasPrev: true,
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

    render(<JobRow job={baseJob} onOpen={onOpen} onStatusChange={onStatusChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: /detalhes/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(onOpen).toHaveBeenCalledWith(baseJob);
    expect(onStatusChange).toHaveBeenCalledWith(baseJob.id, "saved");
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

    expect(screen.getByText(/payload da vaga/i)).toBeInTheDocument();
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
    expect(screen.getAllByText(/detalhes avançados da vaga/i)).toHaveLength(2);
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
    fireEvent.change(screen.getByPlaceholderText(/react, typescript, node.js/i), {
      target: { value: "NestJS, PostgreSQL" },
    });
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
      const [filterType, setFilterType] = useState("Todos");
      const [filterLevel, setFilterLevel] = useState("Todos");
      const [continentFilter, setContinentFilter] =
        useState<ContinentFilter>("Todos");
      const [countryFilter, setCountryFilter] =
        useState<CountryFilter>("Todos");
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
          matchSort={matchSort}
          setMatchSort={setMatchSort}
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

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "Remoto" },
    });
    expect(screen.getByText("Remote React")).toBeInTheDocument();
    expect(screen.getByText("Onsite Java")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /detalhes/i })[0]);
    expect(onOpenJob).toHaveBeenCalled();
    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
