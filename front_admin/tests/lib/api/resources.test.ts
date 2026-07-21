import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditApi } from "../../../src/lib/api/audit.api";
import { dashboardApi } from "../../../src/lib/api/dashboard.api";
import { observabilityApi } from "../../../src/lib/api/observability.api";
import { permissionsApi } from "../../../src/lib/api/permissions.api";
import { scrapersApi } from "../../../src/lib/api/scrapers.api";
import { adminUsersApi } from "../../../src/lib/api/users.api";
import { api } from "../../../src/lib/api/client";

vi.mock("../../../src/lib/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe("api resources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds audit query strings without empty values", () => {
    mockedApi.get.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });

    auditApi.list({
      action: "login",
      actorId: "",
      limit: 20,
      offset: 0,
    });

    expect(mockedApi.get).toHaveBeenCalledWith(
      "/admin/audit?action=login&limit=20&offset=0",
    );
  });

  it("calls dashboard overview endpoint", () => {
    dashboardApi.getOverview();

    expect(mockedApi.get).toHaveBeenCalledWith("/admin/dashboard");
  });

  it("calls observability endpoints with expected options", () => {
    observabilityApi.health();
    observabilityApi.metrics();
    observabilityApi.dashboards("1h");

    expect(mockedApi.get).toHaveBeenNthCalledWith(
      1,
      "/admin/observability/health",
      { acceptedStatuses: [503] },
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      2,
      "/admin/observability/metrics",
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      3,
      "/admin/observability/dashboards?range=1h",
    );
  });

  it("updates permission rules payload", () => {
    permissionsApi.list();
    permissionsApi.update([
      { resource: "users", action: "read", minRole: "admin" },
    ]);

    expect(mockedApi.get).toHaveBeenCalledWith("/admin/permissions/rules");
    expect(mockedApi.patch).toHaveBeenCalledWith(
      "/admin/permissions/rules",
      {
        rules: [{ resource: "users", action: "read", minRole: "admin" }],
      },
    );
  });

  it("calls scraper endpoints", () => {
    scrapersApi.list();
    scrapersApi.status();
    scrapersApi.jobs();
    scrapersApi.jobsCount();
    scrapersApi.trigger();
    scrapersApi.clearJobsCache();

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, "/admin/scrapers");
    expect(mockedApi.get).toHaveBeenNthCalledWith(2, "/admin/scrapers/status");
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      3,
      "/admin/scrapers/jobs?limit=200",
    );
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      4,
      "/admin/scrapers/jobs/count",
    );
    expect(mockedApi.post).toHaveBeenCalledWith("/admin/scrapers/run");
    expect(mockedApi.delete).toHaveBeenCalledWith("/admin/jobs/cache");
  });

  it("calls admin user mutation endpoints", () => {
    adminUsersApi.list();
    adminUsersApi.list({ limit: 100, offset: 200 });
    adminUsersApi.block("u1");
    adminUsersApi.unblock("u1");
    adminUsersApi.changeRole("u1", "support");
    adminUsersApi.delete("u1");

    expect(mockedApi.get).toHaveBeenNthCalledWith(1, "/admin/users");
    expect(mockedApi.get).toHaveBeenNthCalledWith(
      2,
      "/admin/users?limit=100&offset=200",
    );
    expect(mockedApi.patch).toHaveBeenNthCalledWith(
      1,
      "/admin/users/u1/block",
    );
    expect(mockedApi.patch).toHaveBeenNthCalledWith(
      2,
      "/admin/users/u1/unblock",
    );
    expect(mockedApi.patch).toHaveBeenNthCalledWith(
      3,
      "/admin/users/u1/role",
      { role: "support" },
    );
    expect(mockedApi.delete).toHaveBeenCalledWith("/admin/users/u1");
  });
});
