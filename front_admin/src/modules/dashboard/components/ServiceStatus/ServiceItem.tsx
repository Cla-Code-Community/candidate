import { StatusBadge } from "../../../../components/ui/StatusBadge";
import type { ServiceHealth } from "../../schemas/service.schemas";

interface ServiceItemProps {
  service: ServiceHealth;
}

export function ServiceItem({ service }: ServiceItemProps) {
  const dotColor =
    service.tone === "success"
      ? "bg-emerald-500"
      : service.tone === "warning"
        ? "bg-amber-500"
        : "bg-rose-500";

  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {service.name}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge label={service.status} tone={service.tone} withDot={false} />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-10 text-right">
          {service.sla}
        </span>
      </div>
    </div>
  );
}
