import type { ScraperSummary } from "../../schemas/scraper.schemas";
import { ScraperTable } from "./ScraperTable";

interface RunningScrapersProps {
  scrapers: ScraperSummary[];
  onToggle: (id: string) => void;
  onViewAll: () => void;
  operationalMessage?: string;
}

export function RunningScrapers({
  scrapers,
  onToggle,
  onViewAll,
  operationalMessage,
}: RunningScrapersProps) {
  const activeCount = scrapers.some((scraper) => scraper.status === "N/D") ? null : scrapers.filter((scraper) => scraper.active).length;

  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between theme-transition">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Processamento em execução
          </h3>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded">
            {activeCount === null ? "N/D" : `${activeCount}/${scrapers.length} ativos`}
          </span>
        </div>
        {operationalMessage && <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{operationalMessage}</p>}
        <ScraperTable
          scrapers={scrapers}
          onToggle={onToggle}
          onConfigure={onViewAll}
        />
      </div>

      <button
        onClick={onViewAll}
        className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors pt-4 mt-4 border-t border-slate-100 dark:border-slate-800"
      >
        Ver processamento de vagas
      </button>
    </div>
  );
}
