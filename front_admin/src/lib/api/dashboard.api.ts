import { api } from "./client";
import type { DashboardOverview } from "./types";

export const dashboardApi = {
  getOverview: (signal?: AbortSignal) => api.get<DashboardOverview>("/admin/dashboard", { signal }),
};
