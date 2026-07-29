import type { Scraper } from "../../schemas/scraper.schema";
import { ScraperCard } from "./ScraperCard";

interface ScraperGridProps {
  scrapers: Scraper[];
  isStarting: boolean;
  onToggle: (id: string) => void;
  onStartAll: () => void;
  onPauseAll: () => void;
}

export function ScraperGrid({
  scrapers,
  isStarting,
  onToggle,
  onStartAll,
  onPauseAll,
}: ScraperGridProps) {
  const hasRunningScraper = scrapers.some((scraper) => scraper.active);
  const startDisabled = isStarting || hasRunningScraper;

  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm theme-transition">
      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Status Geral dos Scrapers
          </h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Consulte o desempenho, volume de dados e inicie/interrompa o fluxo
            de scraping de vagas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onStartAll}
            disabled={startDisabled}
            title={
              hasRunningScraper
                ? "Já existe uma execução em andamento"
                : "Iniciar execução dos scrapers"
            }
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting
              ? "Iniciando..."
              : hasRunningScraper
                ? "Em execução"
                : "Iniciar Todos"}
          </button>
          <button
            onClick={onPauseAll}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Pausar Todos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scrapers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400 md:col-span-2 lg:col-span-4">
            Nenhum scraper retornado pelo backend.
          </div>
        ) : (
          scrapers.map((scraper) => (
            <ScraperCard key={scraper.id} scraper={scraper} onToggle={onToggle} />
          ))
        )}
      </div>
    </div>
  );
}
