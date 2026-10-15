import { Search, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { jobLevels } from "../../constants";
import type { JobModelFilter, MatchSort } from "../../types";
import { jobModelFilterOptions } from "../../utils/jobModelFilters";
import {
  continentOptions,
  countryOptions,
  type ContinentFilter,
  type CountryFilter,
} from "../../utils/locationFilters";

interface JobFilterProps {
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
  matchSort: MatchSort;
  setMatchSort: (value: MatchSort) => void;
  selectedFamilies?: string[];
  setSelectedFamilies?: (value: string[]) => void;
  familyOptions?: Array<{ id: string; label: string }>;
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
  selectedFamilies = [],
  setSelectedFamilies,
  familyOptions = [],
}: JobFilterProps) {
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const familyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        familyDropdownRef.current &&
        !familyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFamilyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const familyLabel = useMemo(() => {
    const list = selectedFamilies ?? [];
    const opts = familyOptions ?? [];
    if (list.length === 0) return "Área profissional (Todas)";
    if (list.length === 1) {
      const found = opts.find((f) => f.id === list[0]);
      return found ? found.label : list[0];
    }
    return `${list.length} áreas selecionadas`;
  }, [selectedFamilies, familyOptions]);

  const activeSelected = selectedFamilies ?? [];
  const activeOptions = familyOptions ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(280px,1fr)_220px_repeat(5,minmax(0,180px))]">
      <label className="relative block min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          maxLength={100}
          placeholder="Buscar por cargo, empresa ou keywords..."
          className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors focus:border-ring"
        />
      </label>

      <div className="relative min-w-0" ref={familyDropdownRef}>
        <button
          type="button"
          onClick={() => setIsFamilyOpen(!isFamilyOpen)}
          className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
          aria-expanded={isFamilyOpen}
          aria-label="Filtrar por área profissional"
        >
          <span className="truncate">{familyLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        {isFamilyOpen && (
          <div className="absolute left-0 right-0 top-12 z-50 max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-2 shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-2 pb-2 pt-1.5">
              <span className="text-xs font-bold text-muted-foreground">
                Áreas profissionais
              </span>
              {activeSelected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFamilies?.([])}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="mt-1 space-y-1">
              {activeOptions.map((family) => {
                const isSelected = activeSelected.includes(family.id);
                return (
                  <label
                    key={family.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (!setSelectedFamilies) return;
                        if (e.target.checked) {
                          setSelectedFamilies([
                            ...activeSelected,
                            family.id,
                          ]);
                        } else {
                          setSelectedFamilies(
                            activeSelected.filter((id) => id !== family.id),
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span className="font-medium text-foreground">
                      {family.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <select
        value={filterLevel}
        onChange={(event) => setFilterLevel(event.target.value)}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="Todos">Sênioridade (Todos)</option>
        {jobLevels.map((level) => (
          <option key={level}>{level}</option>
        ))}
      </select>

      <select
        value={filterType}
        onChange={(event) =>
          setFilterType(event.target.value as JobModelFilter)
        }
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="Todos">Modelo (Todos)</option>
        {jobModelFilterOptions
          .filter((option) => option.value !== "Todos")
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>

      <select
        value={continentFilter}
        onChange={(event) =>
          setContinentFilter(event.target.value as ContinentFilter)
        }
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
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
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
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
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
      >
        <option value="default">Match (padrão)</option>
        <option value="desc">Maior match</option>
        <option value="asc">Menor match</option>
      </select>
    </div>
  );
}
