import { OperationalSnapshotSchema } from "../../modules/observability/schemas/operationalSnapshot.schema";
import { api } from "./client";
import type {
  HealthcheckResponse,
  MetricSnapshot,
  ObservabilityDashboards,
} from "./types";

export type ObservabilityRange = "5m" | "15m" | "1h" | "6h" | "24h";

export const observabilityApi = {
  async getOperationalSnapshot(signal?: AbortSignal) {
    return OperationalSnapshotSchema.parse(
      await api.get<unknown>("/admin/observability", { signal, cache: "no-store" }),
    );
  },
  health: (signal?: AbortSignal) =>
    api.get<HealthcheckResponse>("/admin/observability/health", {
      acceptedStatuses: [503],
      signal,
    }),
  metrics: (signal?: AbortSignal) => api.get<MetricSnapshot>("/admin/observability/metrics", { signal }),
  dashboards: (range: ObservabilityRange, signal?: AbortSignal) =>
    api.get<ObservabilityDashboards>(
      `/admin/observability/dashboards?range=${range}`,
      { signal },
    ),
};
