import { useEffect, useState } from "react";
import type { DashboardStats, ResourceUsage } from "../schemas";
import { dashboardService } from "../services/dashboard.service";

export function useDashboardMetrics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [resources, setResources] = useState<ResourceUsage | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([dashboardService.getStats(), dashboardService.getResources()])
      .then(([nextStats, nextResources]) => {
        if (!active) return;
        setStats(nextStats);
        setResources(nextResources);
      })
      .catch(() => {
        if (!active) return;
        setStats(null);
        setResources(null);
      });

    return () => {
      active = false;
    };
  }, []);

  return { stats, resources };
}
