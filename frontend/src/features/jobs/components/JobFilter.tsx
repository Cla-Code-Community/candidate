import {
  Search,
  ChevronDown,
  Filter,
  Flag,
  Globe2,
  MapPinned,
  Building2,
  X,
} from "lucide-react";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useId,
  type CSSProperties,
} from "react";
import { cn } from "@/shared/utils/utils";
import { darkColors, lightColors } from "@/app/dashboard/theme/colors";
import { jobLevels } from "../constants";
import type { JobModelFilter } from "../domain/job";
import { jobModelFilterOptions } from "@/features/jobs/domain/jobModelFilters";
import {
  continentOptions,
  countryOptions,
  type ContinentFilter,
  type CountryFilter,
} from "@/features/jobs/domain/locationFilters";

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
  stateFilter: string;
  setStateFilter: (value: string) => void;
  cityFilter: string;
  setCityFilter: (value: string) => void;
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
  stateFilter,
  setStateFilter,
  cityFilter,
  setCityFilter,
  selectedFamilies = [],
  setSelectedFamilies,
  familyOptions = [],
}: JobFilterProps) {
  const [isFamilyOpen, setIsFamilyOpen] = useState(false);
  const familyDropdownRef = useRef<HTMLDivElement>(null);
  const familyDropdownId = useId();

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
    if (list.length === 0) return "Áreas profissionais (Todas)";
    if (list.length === 1) {
      const found = opts.find((f) => f.id === list[0]);
      return found ? found.label : list[0];
    }
    return `${list.length} áreas selecionadas`;
  }, [selectedFamilies, familyOptions]);

  const activeSelected = selectedFamilies ?? [];
  const activeOptions = familyOptions ?? [];
  const inputColors = {
    "--filter-input-light": lightColors.input,
    "--filter-input-dark": darkColors.input,
  } as CSSProperties;
  const controlClassName =
    "h-10 w-full min-w-0 rounded-md border border-input bg-[var(--filter-input-light)] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 dark:bg-[var(--filter-input-dark)]";
  const otherActiveFilters = [
    searchQuery.trim() && `Busca: ${searchQuery.trim()}`,
    filterType !== "Todos" &&
      (jobModelFilterOptions.find((option) => option.value === filterType)
        ?.label ??
        filterType),
    filterLevel !== "Todos" && filterLevel,
    continentFilter !== "Todos" && continentFilter,
    countryFilter !== "Todos" && countryFilter,
    stateFilter.trim() && `Estado / Região: ${stateFilter.trim()}`,
    cityFilter.trim() && `Cidade: ${cityFilter.trim()}`,
  ].filter(Boolean);

  return (
    <>
      <section
        aria-label="Filtros de vagas"
        style={inputColors}
        className="relative z-10 min-w-0 overflow-visible rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm"
      >
        <div
          role="group"
          aria-label="Filtros profissionais"
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]"
        >
          <label className="relative block min-w-0">
            <span className="sr-only">Buscar vagas</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              maxLength={100}
              placeholder="Buscar por cargo, empresa ou keywords..."
              className={cn(controlClassName, "pl-10")}
            />
          </label>

          <div
            className={cn("relative min-w-0", isFamilyOpen && "z-20")}
            ref={familyDropdownRef}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsFamilyOpen(false);
                familyDropdownRef.current?.querySelector("button")?.focus();
              }
            }}
          >
            <button
              type="button"
              onClick={() => setIsFamilyOpen(!isFamilyOpen)}
              className={cn(
                controlClassName,
                "flex items-center justify-between gap-2",
                activeSelected.length > 0 && "border-primary/60",
              )}
              aria-expanded={isFamilyOpen}
              aria-controls={isFamilyOpen ? familyDropdownId : undefined}
              aria-label="Filtrar por área profissional"
            >
              <span className="truncate">{familyLabel}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            {isFamilyOpen && (
              <div
                id={familyDropdownId}
                role="group"
                aria-label="Áreas profissionais disponíveis"
                className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-input bg-background shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    Áreas profissionais
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFamilies?.([])}
                    disabled={
                      activeSelected.length === 0 || !setSelectedFamilies
                    }
                    className="rounded-sm text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    Limpar
                  </button>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain p-2">
                  {activeOptions.map((family) => {
                    const isSelected = activeSelected.includes(family.id);
                    return (
                      <label
                        key={family.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted focus-within:ring-1 focus-within:ring-ring",
                          isSelected && "bg-primary/10",
                        )}
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
            aria-label="Modalidade"
            value={filterType}
            onChange={(event) =>
              setFilterType(event.target.value as JobModelFilter)
            }
            className={cn(
              controlClassName,
              filterType !== "Todos" && "border-primary/60",
            )}
          >
            <option value="Todos">Modalidade (Todas)</option>
            {jobModelFilterOptions
              .filter((option) => option.value !== "Todos")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>

          <select
            aria-label="Senioridade"
            value={filterLevel}
            onChange={(event) => setFilterLevel(event.target.value)}
            className={cn(
              controlClassName,
              filterLevel !== "Todos" && "border-primary/60",
            )}
          >
            <option value="Todos">Senioridade</option>
            {jobLevels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </div>

        <div
          role="group"
          aria-label="Localização"
          className="mt-3 grid min-w-0 grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="block min-w-0 space-y-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Globe2 aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              Continente
            </span>
            <select
              value={continentFilter}
              onChange={(event) =>
                setContinentFilter(event.target.value as ContinentFilter)
              }
              className={cn(
                controlClassName,
                continentFilter !== "Todos" && "border-primary/60",
              )}
            >
              {continentOptions.map((continent) => (
                <option key={continent} value={continent}>
                  {continent === "Todos" ? "Continente (Todos)" : continent}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 space-y-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Flag aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
              País
            </span>
            <select
              value={countryFilter}
              onChange={(event) =>
                setCountryFilter(event.target.value as CountryFilter)
              }
              className={cn(
                controlClassName,
                countryFilter !== "Todos" && "border-primary/60",
              )}
            >
              {countryOptions.map((country) => (
                <option key={country} value={country}>
                  {country === "Todos" ? "País (Todos)" : country}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0 space-y-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPinned
                aria-hidden="true"
                className="h-3.5 w-3.5 text-primary"
              />
              Estado / Região
            </span>
            <input
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              maxLength={100}
              placeholder="Ex: SP, SC..."
              title="Para estados brasileiros, use a sigla, como SP ou SC."
              className={cn(
                controlClassName,
                stateFilter.trim() && "border-primary/60",
              )}
            />
          </label>
          <label className="block min-w-0 space-y-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2
                aria-hidden="true"
                className="h-3.5 w-3.5 text-primary"
              />
              Cidade
            </span>
            <input
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              maxLength={100}
              placeholder="Ex: São Paulo, Lisboa..."
              className={cn(
                controlClassName,
                cityFilter.trim() && "border-primary/60",
              )}
            />
          </label>
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
          <span className="flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground">
            <Filter aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
            Filtros ativos:
          </span>
          {activeSelected.length > 0
            ? activeSelected.map((id) => (
                <span
                  key={id}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-semibold text-primary"
                >
                  <span className="truncate">
                    {activeOptions.find((family) => family.id === id)?.label ??
                      id}
                  </span>
                  {setSelectedFamilies && (
                    <button
                      type="button"
                      aria-label={`Remover área ${activeOptions.find((family) => family.id === id)?.label ?? id}`}
                      onClick={() =>
                        setSelectedFamilies(
                          activeSelected.filter((value) => value !== id),
                        )
                      }
                      className="rounded-sm p-0.5 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))
            : null}
          {otherActiveFilters.map((label) => (
            <span
              key={String(label)}
              className="max-w-full truncate rounded-md border border-border bg-muted px-2 py-1 text-foreground"
            >
              {label}
            </span>
          ))}
          {activeSelected.length === 0 && otherActiveFilters.length === 0 && (
            <span className="text-muted-foreground">
              Nenhum filtro específico selecionado.
            </span>
          )}
        </div>
      </section>
    </>
  );
}
