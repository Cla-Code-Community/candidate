import type { ScraperSummary } from "../../schemas/scraper.schemas";
import { ScraperTable } from "./ScraperTable";

interface RunningScrapersProps {
  scrapers: ScraperSummary[];
  onToggle: (id: string) => void;
  onViewAll: () => void;
}

export function RunningScrapers({
  scrapers,
  onToggle,
  onViewAll,
}: RunningScrapersProps) {
  const activeCount = scrapers.filter((scraper) => scraper.active).length;

  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between theme-transition">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Scrapers em Execução
          </h3>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded">
            {activeCount}/{scrapers.length} ativos
          </span>
        </div>
        <ScraperTable scrapers={scrapers} onToggle={onToggle} />
      </div>

      <button
        onClick={onViewAll}
        className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors pt-4 mt-4 border-t border-slate-100 dark:border-slate-800"
      >
        Ver todos os scrapers
      </button>
    </div>
  );
}
