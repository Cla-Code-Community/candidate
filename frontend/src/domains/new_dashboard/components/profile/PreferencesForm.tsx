import type { JobModelFilter, SearchPreferences } from "../../types";
import {
  getJobTypesFromModelFilter,
  getModelFilterFromJobTypes,
  jobModelFilterOptions,
} from "../../utils/jobModelFilters";

interface PreferencesFormProps {
  searchPreferences: SearchPreferences;
  setSearchPreferences: React.Dispatch<React.SetStateAction<SearchPreferences>>;
  isSaving?: boolean;
  onSave: (searchPreferences: SearchPreferences) => Promise<void>;
}

export function PreferencesForm({
  searchPreferences,
  setSearchPreferences,
  isSaving = false,
  onSave,
}: PreferencesFormProps) {
  const preferredModelFilter = getModelFilterFromJobTypes(
    searchPreferences.jobTypes,
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-[18px] font-bold">Preferências de Carreira</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Esses filtros personalizam como suas vagas são mostradas na tela de busca principal.
      </p>

      <div className="mt-5 rounded-xl border border-border bg-muted/35 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary dark:text-emerald-400">
          Preferências de Busca
        </h3>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
              Localidade Principal de Busca
            </span>
            <input
              type="text"
              value={searchPreferences.searchLocation}
              onChange={(event) =>
                setSearchPreferences((current) => ({
                  ...current,
                  searchLocation: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-ring"
            />
          </label>

          <div className="flex flex-col justify-center gap-4">
            <label>
              <span className="mb-2 block text-xs font-bold uppercase text-muted-foreground">
                Vagas Exibidas Inicialmente
              </span>
              <select
                value={preferredModelFilter}
                onChange={(event) => {
                  const jobTypes = getJobTypesFromModelFilter(
                    event.target.value as JobModelFilter,
                  );
                  setSearchPreferences((current) => ({
                    ...current,
                    jobTypes,
                    remoteOnly:
                      jobTypes.length === 1 && jobTypes[0] === "Remoto",
                  }));
                }}
                className="h-10 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none focus:border-ring"
              >
                {jobModelFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-muted-foreground">
                Define o filtro padrão aplicado automaticamente na tela de vagas.
              </span>
            </label>

            <label className="flex cursor-pointer select-none items-start gap-3 text-xs font-bold text-muted-foreground">
              <input
                type="checkbox"
                checked={searchPreferences.emailNotifications}
                onChange={(event) =>
                  setSearchPreferences((current) => ({
                    ...current,
                    emailNotifications: event.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <span>
                <span className="block text-foreground">Habilitar Alertas de Vagas no E-mail</span>
                <span className="mt-1 block font-normal">
                  Receber resumos diários de novas vagas com alto Match Score.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={() => onSave(searchPreferences)}
          disabled={isSaving}
          className="h-10 rounded-md bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Salvando..." : "Salvar Preferências"}
        </button>
      </div>
    </section>
  );
}
