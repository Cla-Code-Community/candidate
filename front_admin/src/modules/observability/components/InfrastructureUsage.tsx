import { UsageBar } from "../../../components/ui/UsageBar";
import type { InfraUsage } from "../schemas/observability.schemas";

interface InfrastructureUsageProps {
  usage: InfraUsage[];
}

export function InfrastructureUsage({ usage }: InfrastructureUsageProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f131a]">
      <h4 className="mb-4 text-sm font-bold text-slate-800 dark:text-slate-100">
        Consumo de Infraestrutura Dedicada
      </h4>
      <div className="space-y-4">
        {usage.map((item) => (
          <UsageBar
            key={item.label}
            label={item.label}
            valueLabel={item.valueLabel}
            percentage={item.percentage}
            color={item.color}
          />
        ))}
      </div>
    </div>
  );
}
