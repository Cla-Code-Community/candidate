import { Search } from "lucide-react";
import { jobLevels, jobTypes } from "../../constants";
import type { MatchSort } from "../../types";
import {
  continentOptions,
  countryOptions,
  type ContinentFilter,
  type CountryFilter,
} from "../../utils/locationFilters";

interface JobFilterProps {
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
}

export function JobFilter({
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
}: JobFilterProps) {
  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 md:grid-cols-[minmax(280px,1fr)_168px_168px_180px_180px_180px]">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por cargo, empresa ou keywords..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-ring"
        />
      </label>

      <select
        value={filterType}
        onChange={(event) => setFilterType(event.target.value)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="Todos">Modelo (Todos)</option>
        {jobTypes.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </select>

      <select
        value={filterLevel}
        onChange={(event) => setFilterLevel(event.target.value)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="Todos">Sênioridade (Todos)</option>
        {jobLevels.map((level) => (
          <option key={level}>{level}</option>
        ))}
      </select>

      <select
        value={continentFilter}
        onChange={(event) =>
          setContinentFilter(event.target.value as ContinentFilter)
        }
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        {continentOptions.map((continent) => (
          <option key={continent} value={continent}>
            {continent === "Todos" ? "Continente (Todos)" : continent}
          </option>
        ))}
      </select>

      <select
        value={countryFilter}
        onChange={(event) =>
          setCountryFilter(event.target.value as CountryFilter)
        }
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        {countryOptions.map((country) => (
          <option key={country} value={country}>
            {country === "Todos" ? "País (Todos)" : country}
          </option>
        ))}
      </select>

      <select
        value={matchSort}
        onChange={(event) => setMatchSort(event.target.value as MatchSort)}
        className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="default">Match (padrão)</option>
        <option value="desc">Maior match</option>
        <option value="asc">Menor match</option>
      </select>
    </div>
  );
}
