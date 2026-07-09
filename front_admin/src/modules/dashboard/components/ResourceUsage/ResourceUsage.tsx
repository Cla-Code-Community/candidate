import { ProgressCircle } from "../../../../components/ui/ProgressCircle";
import type { ResourceUsage } from "../../schemas";

interface ResourceUsageProps {
  resources: ResourceUsage;
  onViewMore: () => void;
}

export function ResourceUsage({ resources, onViewMore }: ResourceUsageProps) {
  return (
    <div className="bg-white dark:bg-[#0f131a] p-6 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between theme-transition">
      <div>
        <div className="mb-5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Disponibilidade
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Score calculado a partir do healthcheck atual
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <ProgressCircle value={resources.scraper} color="#10b981" label="Scraper" />
          <ProgressCircle
            value={resources.postgres}
            color="#8b5cf6"
            label="Postgres"
          />
          <ProgressCircle
            value={resources.valkey}
            color="#3b82f6"
            label="Valkey"
          />
        </div>
      </div>

      <button
        onClick={onViewMore}
        className="w-full text-center text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors pt-4 mt-6 border-t border-slate-100 dark:border-slate-800"
      >
        Ver métricas completas
      </button>
    </div>
  );
}
