import { Play, Settings } from "lucide-react";

import { useNotifications } from "../../../../components/notifications/useNotifications";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { formatNumber } from "../../../../utils/formatNumber";
import type { ScraperSummary } from "../../schemas/scraper.schemas";

interface ScraperRowProps {
  scraper: ScraperSummary;
  onToggle: (id: string) => void;
}

export function ScraperRow({ scraper, onToggle }: ScraperRowProps) {
  const { notify } = useNotifications();

  return (
    <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/60 transition-colors">
      <td className="py-3.5 font-bold text-slate-700 dark:text-slate-200">{scraper.name}</td>
      <td className="py-3.5">
        <StatusBadge
          label={scraper.status}
          tone={scraper.active ? "success" : "neutral"}
        />
      </td>
      <td className="py-3.5 text-slate-500 dark:text-slate-400 font-medium">{scraper.lastRun}</td>
      <td className="py-3.5 font-bold text-slate-800 dark:text-slate-100">
        {formatNumber(scraper.collected24h)}
      </td>
      <td className="py-3.5 text-right space-x-1">
        <button
          onClick={() => onToggle(scraper.id)}
          title={scraper.active ? "Pausar Scraper" : "Iniciar Scraper"}
          className={`p-1.5 rounded-md inline-flex items-center justify-center transition-colors ${
            scraper.active
              ? "hover:bg-amber-50 dark:hover:bg-amber-500/10 text-amber-600 dark:text-amber-300"
              : "hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
          }`}
        >
          {scraper.active ? (
            <span className="text-[10px] font-bold px-1">Pausar</span>
          ) : (
            <Play size={12} />
          )}
        </button>
        <button
          onClick={() =>
            notify({
              tone: "warning",
              title: "Configurações em desenvolvimento",
              description: `As configurações de scraping do ${scraper.name} ainda não possuem endpoint conectado.`,
            })
          }
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md inline-flex items-center justify-center"
        >
          <Settings size={12} />
        </button>
      </td>
    </tr>
  );
}
