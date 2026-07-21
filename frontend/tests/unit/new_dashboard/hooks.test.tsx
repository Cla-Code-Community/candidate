import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/lib/apiError";

const dashboardApiMock = vi.hoisted(() => ({
  getDashboardSavedJobs: vi.fn(),
  searchDashboardJobs: vi.fn(),
  createDashboardSavedJob: vi.fn(),
  updateDashboardSavedJob: vi.fn(),
}));

vi.mock("@/domains/new_dashboard/infrastructure/dashboardJobsApi", () => ({
  getDashboardSavedJobs: dashboardApiMock.getDashboardSavedJobs,
  searchDashboardJobs: dashboardApiMock.searchDashboardJobs,
  createDashboardSavedJob: dashboardApiMock.createDashboardSavedJob,
  updateDashboardSavedJob: dashboardApiMock.updateDashboardSavedJob,
}));

import { useDashboardJobs } from "@/domains/new_dashboard/hooks/useDashboardJobs";
import type { User } from "@/domains/auth/domain/auth.types";
import type { Job } from "@/domains/new_dashboard/types";

const user: User = {
  id: "user-1",
  email: "maria@exemplo.com",
};

const trackedJob: Job = {
  id: "tracked-1",
  jobTitle: "Tracked Job",
  company: "ACME",
  location: "Brasil",
  salary: "A combinar",
  type: "Remoto",
  level: "Pleno",
  matchScore: 90,
  tags: ["React"],
  posted: "Hoje",
  status: "saved",
  jobLink: "https://example.com/tracked",
  source: "LinkedIn",
  notes: "nota",
};

const recommendedJob: Job = {
  id: "rec-1",
  jobTitle: "Recommended Job",
  company: "Globex",
  location: "Portugal",
  salary: "A combinar",
  type: "Híbrido",
  level: "Sênior",
  matchScore: 88,
  tags: ["TypeScript"],
  posted: "Hoje",
  status: "saved",
  jobLink: "https://example.com/recommended",
  source: "Gupy",
  notes: "",
};

describe("useDashboardJobs", () => {
  beforeEach(() => {
    localStorage.clear();
    dashboardApiMock.getDashboardSavedJobs.mockReset();
    dashboardApiMock.searchDashboardJobs.mockReset();
    dashboardApiMock.createDashboardSavedJob.mockReset();
    dashboardApiMock.updateDashboardSavedJob.mockReset();
  });

  it("carrega vagas salvas e recomendadas, removendo duplicadas", async () => {
    dashboardApiMock.getDashboardSavedJobs.mockResolvedValue([trackedJob]);
    dashboardApiMock.searchDashboardJobs.mockResolvedValue({
      jobs: [trackedJob, recommendedJob],
      pagination: {
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    localStorage.setItem(
      "new-dashboard-tracked-jobs:user-1",
      JSON.stringify([trackedJob]),
    );

    const { result } = renderHook(() => useDashboardJobs(user));

    await waitFor(() => {
      expect(result.current.isLoadingJobs).toBe(false);
    });

    expect(result.current.trackedJobs).toEqual([trackedJob]);
    expect(result.current.recommendedJobs).toEqual([recommendedJob]);
    expect(result.current.recommendedPagination.total).toBe(2);
    expect(localStorage.getItem("new-dashboard-tracked-jobs:user-1")).toContain(
      "tracked-1",
    );
  });

  it("refresca recomendações e troca paginação remota", async () => {
    dashboardApiMock.getDashboardSavedJobs.mockResolvedValue([]);
    dashboardApiMock.searchDashboardJobs
      .mockResolvedValueOnce({
        jobs: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      })
      .mockResolvedValueOnce({
        jobs: [recommendedJob],
        pagination: {
          total: 10,
          page: 2,
          limit: 25,
          totalPages: 4,
          hasNext: true,
          hasPrev: true,
        },
      });

    const { result } = renderHook(() => useDashboardJobs(user));

    await waitFor(() => {
      expect(result.current.isLoadingJobs).toBe(false);
    });

    await act(async () => {
      await result.current.refreshRecommendations(["React"], { type: "Remoto" }, 2, 25);
    });

    expect(dashboardApiMock.searchDashboardJobs).toHaveBeenLastCalledWith(
      ["React"],
      { type: "Remoto" },
      2,
      25,
    );
    expect(result.current.recommendedJobs).toEqual([recommendedJob]);

    dashboardApiMock.searchDashboardJobs.mockResolvedValueOnce({
      jobs: [recommendedJob],
      pagination: {
        total: 8,
        page: 3,
        limit: 25,
        totalPages: 4,
        hasNext: true,
        hasPrev: true,
      },
    });

    await act(async () => {
      await result.current.changeRecommendationsPage(3);
    });

    expect(dashboardApiMock.searchDashboardJobs).toHaveBeenLastCalledWith(
      ["React"],
      { type: "Remoto" },
      3,
      25,
    );
  });

  it("adiciona vaga salva, trata conflito e atualiza status/notas", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    dashboardApiMock.getDashboardSavedJobs.mockResolvedValue([trackedJob]);
    dashboardApiMock.searchDashboardJobs.mockResolvedValue({
      jobs: [recommendedJob],
      pagination: {
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      },
    });
    dashboardApiMock.createDashboardSavedJob.mockResolvedValue(trackedJob);
    dashboardApiMock.updateDashboardSavedJob.mockResolvedValue({
      ...trackedJob,
      status: "applied",
      notes: "nota atualizada",
    });

    const { result } = renderHook(() => useDashboardJobs(user));

    await waitFor(() => {
      expect(result.current.isLoadingJobs).toBe(false);
    });

    await act(async () => {
      await result.current.addTrackedJob({
        jobTitle: "New job",
        company: "ACME",
        location: "Brasil",
        salary: "A combinar",
        type: "Remoto",
        level: "Pleno",
        tags: "React",
        source: "LinkedIn",
        jobLink: "https://example.com/new",
        notes: "",
      });
    });

    dashboardApiMock.createDashboardSavedJob.mockRejectedValueOnce(
      new ApiError("CONFLICT", "duplicada", 409),
    );
    dashboardApiMock.getDashboardSavedJobs.mockResolvedValueOnce([trackedJob]);

    await act(async () => {
      await result.current.addTrackedJob({
        jobTitle: "New job",
        company: "ACME",
        location: "Brasil",
        salary: "A combinar",
        type: "Remoto",
        level: "Pleno",
        tags: "React",
        source: "LinkedIn",
        jobLink: "https://example.com/new",
        notes: "",
      });
    });

    await act(async () => {
      await result.current.changeJobStatus("tracked-1", "applied");
      await result.current.changeJobStatus("rec-1", "interviewing");
      result.current.changeJobNotesLocally("tracked-1", "nota atualizada");
      await result.current.saveJobNotes({
        ...trackedJob,
        notes: "nota atualizada",
      });
    });

    expect(dashboardApiMock.updateDashboardSavedJob).toHaveBeenCalledWith(
      "tracked-1",
      { status: "applied" },
    );
    expect(dashboardApiMock.createDashboardSavedJob).toHaveBeenCalled();
    const notificationEvents = dispatchSpy.mock.calls
      .map(([event]) => event)
      .filter((event) => event.type === "dashboard:notifications-refresh");
    expect(notificationEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          detail: expect.objectContaining({
            channel: "notification",
            incrementUnread: true,
            item: expect.objectContaining({
              text: expect.stringContaining("Sua candidatura para"),
              type: "success",
            }),
          }),
        }),
      ]),
    );
    expect(result.current.trackedJobs[0].notes).toBe("nota atualizada");
    dispatchSpy.mockRestore();
  });

  it("limpa estado quando não há usuário", async () => {
    const { result } = renderHook(() => useDashboardJobs(null));

    expect(result.current.trackedJobs).toEqual([]);
    expect(result.current.recommendedJobs).toEqual([]);
    expect(result.current.isLoadingJobs).toBe(false);
  });

  it("ignora mutações quando não há usuário e trata erros de busca", async () => {
    const onError = vi.fn();
    dashboardApiMock.getDashboardSavedJobs.mockResolvedValue([]);
    dashboardApiMock.searchDashboardJobs
      .mockResolvedValueOnce({
        jobs: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      })
      .mockRejectedValueOnce(new Error("falha recomendações"));

    const { result } = renderHook(() =>
      useDashboardJobs(user, { onError }),
    );

    await waitFor(() => {
      expect(result.current.isLoadingJobs).toBe(false);
    });

    await expect(
      result.current.refreshRecommendations(["React"], {}, 1, 50),
    ).rejects.toThrow("falha recomendações");
    expect(onError).toHaveBeenCalledWith("falha recomendações");

    const nullUserResult = renderHook(() => useDashboardJobs(null)).result;
    await act(async () => {
      await nullUserResult.current.addTrackedJob({
        jobTitle: "Sem usuário",
        company: "ACME",
        location: "Brasil",
        salary: "A combinar",
        type: "Remoto",
        level: "Pleno",
        tags: "React",
        source: "LinkedIn",
        jobLink: "https://example.com/null",
        notes: "",
      });
      await nullUserResult.current.changeJobStatus("x", "applied");
      nullUserResult.current.changeJobNotesLocally("x", "nota");
      await nullUserResult.current.saveJobNotes(trackedJob);
    });

    expect(dashboardApiMock.createDashboardSavedJob).not.toHaveBeenCalled();
    expect(dashboardApiMock.updateDashboardSavedJob).not.toHaveBeenCalled();
  });
});
