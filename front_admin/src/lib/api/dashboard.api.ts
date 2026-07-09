import { api } from "./client";
import type { DashboardOverview } from "./types";

export const dashboardApi = {
  getOverview: () => api.get<DashboardOverview>("/admin/dashboard"),
};
