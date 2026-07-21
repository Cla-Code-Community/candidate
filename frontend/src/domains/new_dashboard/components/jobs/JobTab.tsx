import { Search } from "lucide-react";
import type { Job, JobStatus, MatchSort, SearchPreferences } from "../../types";
import {
  type ContinentFilter,
  type CountryFilter,
} from "../../utils/locationFilters";
import { JobFilter } from "./JobFilter";
import { JobTable } from "./JobTable";

interface JobTabProps {
  jobs: Job[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterType: string;
  setFilterType: (value: string) => void;
  filterLevel: string;
  setFilterLevel: (value: string) => void;
  continentFilter: ContinentFilter;
  setContinentFilter: (value: ContinentFilter) => void;
  countryFilter: CountryFilter;
  setCountryFilter: (value: CountryFilter) => void;
  matchSort: MatchSort;
  setMatchSort: (value: MatchSort) => void;
  searchPreferences?: SearchPreferences;
  isSearching?: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onSearchJobs: () => void;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (limit: number) => void;
  onOpenJob: (job: Job) => void;
  onStatusChange: (jobId: string, status: JobStatus) => void;
}

export function JobTab({
  jobs,
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterLevel,
  setFilterLevel,
  continentFilter,
  setContinentFilter,
  countryFilter,
  setCountryFilter,
  matchSort,
  setMatchSort,
  searchPreferences,
  isSearching = false,
  pagination,
  onSearchJobs,
  onPageChange,
  onPageSizeChange,
  onOpenJob,
  onStatusChange,
}: JobTabProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-6 py-8 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            Vagas abertas recomendadas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encontramos oportunidades ideais com base nas preferências do seu
            perfil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSearchJobs()}
          disabled={isSearching}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
        >
          <Search className="h-5 w-5" />
          {isSearching ? "Procurando..." : "Buscar vagas"}
        </button>
      </div>

      <JobFilter
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
      />

      {searchPreferences?.remoteOnly && (
        <p className="text-sm font-semibold text-emerald-600">
          • Filtro de busca ativo: Apenas oportunidades remotas habilitado nas
          preferências.
        </p>
      )}

      <JobTable
        jobs={jobs}
        pagination={pagination}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onOpenJob={onOpenJob}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
