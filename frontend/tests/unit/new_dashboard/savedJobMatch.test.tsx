import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardJobs } from "@/features/jobs/hooks/useDashboardJobs";
import { KanbanBoard } from "@/features/applications/components/KanbanBoard";

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/shared/api/apiClient", () => ({ api: apiMock }));

const user = { id: "match-user", email: "candidate@example.com" };

describe("compatibilidade entre busca, salvamento e recarga", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it.each([83, 0, null])("não fabrica compatibilidade ao salvar score %s sem suporte no contrato", async (matchScore) => {
    const catalogJob = {
      title: "Backend Engineer", company: "ACME", location: "Remoto",
      url: "https://example.com/backend", keyword: "TypeScript",
      matchScore, matchSource: "backend_profile", matchedTechnologies: ["TypeScript"],
    };
    const savedJob = {
      id: "saved-uuid", jobLink: catalogJob.url, jobTitle: catalogJob.title,
      company: "ACME", location: "Remoto", keyword: "TypeScript", status: "saved",
    };
    let saved = false;
    apiMock.get.mockImplementation(async (path: string) => ({
      data: path === "/saved-jobs" ? (saved ? [savedJob] : []) : { jobs: [catalogJob] },
    }));
    apiMock.post.mockImplementation(async () => {
      saved = true;
      return { data: savedJob };
    });

    const first = renderHook(() => useDashboardJobs(user));
    await waitFor(() => expect(first.result.current.isLoadingJobs).toBe(false));
    const recommended = first.result.current.recommendedJobs[0];
    expect(recommended.matchScore).toBe(matchScore);
    expect(recommended.rawPayload?.matchSource).toBe("backend_profile");
    await act(async () => { await first.result.current.changeJobStatus(recommended.id, "saved"); });
    expect(apiMock.post).toHaveBeenCalledWith("/saved-jobs", expect.objectContaining({
      jobLink: catalogJob.url, status: "saved", keyword: "TypeScript",
    }));
    expect(apiMock.post.mock.lastCall?.[1]).not.toHaveProperty("matchScore");
    expect(first.result.current.trackedJobs[0]).toMatchObject({ id: savedJob.id, matchScore: null });
    expect(first.result.current.recommendedJobs).toEqual([]);
    expect(catalogJob.matchScore).toBe(matchScore);
    const board = render(<KanbanBoard jobs={first.result.current.trackedJobs} onOpenJob={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByText("Não calculado")).toBeInTheDocument();
    expect(screen.queryByText("45% Match")).not.toBeInTheDocument();
    first.unmount();

    const reloaded = renderHook(() => useDashboardJobs(user));
    await waitFor(() => expect(reloaded.result.current.isLoadingJobs).toBe(false));
    expect(reloaded.result.current.trackedJobs[0].matchScore).toBeNull();
    board.rerender(<KanbanBoard jobs={reloaded.result.current.trackedJobs} onOpenJob={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByText("Não calculado")).toBeInTheDocument();
  });

  it.each([83, 0, null])("o Kanban exibe fielmente o score disponível %s", (matchScore) => {
    render(<KanbanBoard jobs={[{
      id: "saved", jobTitle: "Backend", company: "ACME", location: "Brasil",
      salary: "A combinar", type: "Remoto", level: "Pleno", matchScore,
      tags: [], posted: "Hoje", status: "saved", jobLink: "https://example.com/backend",
      source: "LinkedIn", notes: "",
    }]} onOpenJob={vi.fn()} onStatusChange={vi.fn()} />);
    expect(screen.getByText(matchScore === null ? "Não calculado" : `${matchScore}% Match`)).toBeInTheDocument();
  });
});
