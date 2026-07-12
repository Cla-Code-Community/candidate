import { formatNumber } from "../../../../utils/formatNumber";
import type { Scraper } from "../../schemas/scraper.schema";

interface ScraperCardProps {
  scraper: Scraper;
  onToggle: (id: string) => void;
}

export function ScraperCard({ scraper, onToggle }: ScraperCardProps) {
  return (
    <div className="flex min-h-40 flex-col justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <div className="flex justify-between items-start">
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            {scraper.name}
          </h4>
          <span
            className={`w-2.5 h-2.5 rounded-full ${scraper.active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
          />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          SLA: {scraper.sla}
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Estado: {scraper.status}
        </p>
      </div>

      <div className="flex justify-between items-center mt-4">
        <div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Vagas no índice
          </p>
          <p className="font-bold text-lg text-slate-800 dark:text-slate-100">
            {formatNumber(scraper.indexedJobs)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            Última execução: {scraper.lastRun}
          </p>
        </div>
        <button
          onClick={() => onToggle(scraper.id)}
          className={`text-xs px-3 py-1.5 font-bold rounded-lg transition-colors ${
            scraper.active
              ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20"
              : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"
          }`}
        >
          {scraper.active ? "Desativar" : "Ativar"}
        </button>
      </div>
    </div>
  );
}
