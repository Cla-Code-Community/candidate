import { Search } from "lucide-react";
import type {
  Job,
  JobModelFilter,
  JobStatus,
  MatchSort,
} from "../domain/job";
import type { SearchPreferences } from "@/features/profile/domain/user";
import {
  type ContinentFilter,
  type CountryFilter,
} from "@/features/jobs/domain/locationFilters";
import {
  getModelFilterFromJobTypes,
  jobModelFilterOptions,
} from "@/features/jobs/domain/jobModelFilters";
import { JobFilter } from "./JobFilter";
import { JobTable } from "./JobTable";

interface JobTabProps {
  jobs: Job[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterType: JobModelFilter;
  setFilterType: (value: JobModelFilter) => void;
  filterLevel: string;
  setFilterLevel: (value: string) => void;
  continentFilter: ContinentFilter;
  setContinentFilter: (value: ContinentFilter) => void;
  countryFilter: CountryFilter;
  setCountryFilter: (value: CountryFilter) => void;
  stateFilter: string;
  setStateFilter: (value: string) => void;
  cityFilter: string;
  setCityFilter: (value: string) => void;
  matchSort: MatchSort;
  setMatchSort: (value: MatchSort) => void;
  selectedFamilies: string[];
  setSelectedFamilies: (value: string[]) => void;
  familyOptions: Array<{ id: string; label: string }>;
  searchPreferences?: SearchPreferences;
  showPreferenceNotice?: boolean;
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
  stateFilter,
  setStateFilter,
  cityFilter,
  setCityFilter,
  matchSort,
  setMatchSort,
  selectedFamilies,
  setSelectedFamilies,
  familyOptions,
  searchPreferences,
  showPreferenceNotice = false,
  isSearching = false,
  pagination,
  onSearchJobs,
  onPageChange,
  onPageSizeChange,
  onOpenJob,
  onStatusChange,
}: JobTabProps) {
  const preferredModelFilter = searchPreferences
    ? getModelFilterFromJobTypes(searchPreferences.jobTypes)
    : "Todos";
  const preferredModelLabel = jobModelFilterOptions.find(
    (option) => option.value === preferredModelFilter,
  )?.label;

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-6 py-8 lg:px-8">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Vagas abertas recomendadas
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Encontramos oportunidades ideais com base nas preferências do seu
            perfil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSearchJobs()}
          disabled={isSearching}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-wait disabled:opacity-60"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
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
        stateFilter={stateFilter}
        setStateFilter={setStateFilter}
        cityFilter={cityFilter}
        setCityFilter={setCityFilter}
        selectedFamilies={selectedFamilies}
        setSelectedFamilies={setSelectedFamilies}
        familyOptions={familyOptions}
      />

      {showPreferenceNotice &&
        preferredModelFilter !== "Todos" &&
        preferredModelLabel && (
        <p className="text-sm font-semibold text-emerald-600">
          • Preferência ativa: {preferredModelLabel.toLowerCase()} como padrão
          nesta busca.
        </p>
      )}

      <JobTable
        jobs={jobs}
        matchSort={matchSort}
        onMatchSortChange={setMatchSort}
        pagination={pagination}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onOpenJob={onOpenJob}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
