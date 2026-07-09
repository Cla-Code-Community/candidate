import { api } from "./client";
import type {
  HealthcheckResponse,
  MetricSnapshot,
  ObservabilityDashboards,
} from "./types";

export type ObservabilityRange = "5m" | "15m" | "1h" | "6h" | "24h";

export const observabilityApi = {
  health: () =>
    api.get<HealthcheckResponse>("/admin/observability/health", {
      acceptedStatuses: [503],
    }),
  metrics: () => api.get<MetricSnapshot>("/admin/observability/metrics"),
  dashboards: (range: ObservabilityRange) =>
    api.get<ObservabilityDashboards>(
      `/admin/observability/dashboards?range=${range}`,
    ),
};
