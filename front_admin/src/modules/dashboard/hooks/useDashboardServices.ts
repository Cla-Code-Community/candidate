import { useEffect, useState } from "react";
import type { ServiceHealth } from "../schemas";
import { dashboardService } from "../services/dashboard.service";

export function useDashboardServices() {
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    let active = true;

    dashboardService
      .getServices()
      .then((nextServices) => {
        if (active) setServices(nextServices);
      })
      .catch(() => {
        if (active) setServices([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return { services };
}
