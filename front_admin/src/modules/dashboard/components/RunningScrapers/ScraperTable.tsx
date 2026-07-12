import type { ScraperSummary } from "../../schemas/scraper.schemas";
import { ScraperRow } from "./ScraperRow";

interface ScraperTableProps {
  scrapers: ScraperSummary[];
  onToggle: (id: string) => void;
}

export function ScraperTable({ scrapers, onToggle }: ScraperTableProps) {
  if (scrapers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">
        Nenhum scraper retornado pelo backend.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold">
            <th className="pb-3 font-semibold">Scraper</th>
            <th className="pb-3 font-semibold">Status</th>
            <th className="pb-3 font-semibold">Última Execução</th>
            <th className="pb-3 font-semibold">Vagas no Índice</th>
            <th className="pb-3 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
          {scrapers.map((scraper) => (
            <ScraperRow
              key={scraper.id}
              scraper={scraper}
              onToggle={onToggle}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
