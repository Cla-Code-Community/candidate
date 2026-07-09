import { Briefcase, Calendar, Users } from "lucide-react";
import type { DashboardStats } from "../../schemas/metrics.schemas";
import { MetricCard } from "./MetricCard";

interface DashboardMetricsProps {
  stats: DashboardStats;
}

export function DashboardMetrics({ stats }: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        label="Total de Usuários"
        metric={stats.totalUsers}
        icon={Users}
      />
      <MetricCard
        label="Usuários Ativos"
        metric={stats.activeUsers}
        icon={Users}
      />
      <MetricCard
        label="Vagas no Índice"
        metric={stats.totalJobs}
        icon={Briefcase}
      />
      <MetricCard label="Vagas Hoje" metric={stats.jobsToday} icon={Calendar} />
    </div>
  );
}
