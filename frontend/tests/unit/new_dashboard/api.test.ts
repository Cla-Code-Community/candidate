import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/shared/lib/apiClient", () => ({
  api: apiMock,
}));

import {
  createDashboardSavedJob,
  deleteDashboardSavedJob,
  getDashboardSavedJobs,
  searchDashboardJobs,
  toRecommendedJob,
  updateDashboardSavedJob,
} from "@/domains/new_dashboard/infrastructure/dashboardJobsApi";
import {
  getUserPreferences,
  getUserProfile,
  toSearchPreferences,
  toUserProfile,
  updateUserPreferences,
  updateUserProfile,
} from "@/domains/new_dashboard/infrastructure/userDashboardApi";

describe("new_dashboard api adapters", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  it("mapeia vagas recomendadas com payload bruto e paginação", async () => {
    apiMock.get.mockResolvedValue({
      data: {
        total: 2,
        page: 3,
        limit: 25,
        totalPages: 4,
        hasNext: true,
        hasPrev: true,
        jobs: [
          {
            title: "Frontend Developer",
            company: "ACME",
            location: "Brasil",
            source: "LinkedIn",
            keyword: "React",
            keywords: ["React", "TypeScript"],
            url: "",
            description: "Detalhe",
          },
        ],
      },
    });

    const result = await searchDashboardJobs(
      ["React"],
      {
        type: "Remoto",
        level: "Pleno",
        location: "Brasil",
      },
      3,
      25,
    );

    expect(apiMock.get).toHaveBeenCalledWith("/jobs/search", {
      params: {
        keywords: "React",
        type: "Remoto",
        level: "Pleno",
        location: "Brasil",
        page: 3,
        limit: 25,
      },
    });
    expect(result.pagination).toEqual({
      total: 2,
      page: 3,
      limit: 25,
      totalPages: 4,
      hasNext: true,
      hasPrev: true,
    });
    expect(result.jobs[0]).toMatchObject({
      jobTitle: "Frontend Developer",
      company: "ACME",
      source: "LinkedIn",
      tags: ["React", "TypeScript"],
      rawPayload: expect.objectContaining({
        description: "Detalhe",
      }),
    });
  });

  it("mapeia vagas salvas e preserva dados auxiliares", async () => {
    apiMock.get.mockResolvedValue({
      data: [
        {
          id: "saved-1",
          jobLink: "https://example.com/job",
          jobTitle: "Backend Developer",
          company: "Globex",
          location: "Portugal",
          source: "Gupy",
          keyword: "Node.js",
          status: "applied",
          notes: "nota",
          createdAt: "2026-07-10T12:00:00.000Z",
        },
      ],
    });

    const jobs = await getDashboardSavedJobs();

    expect(jobs[0]).toMatchObject({
      id: "saved-1",
      jobTitle: "Backend Developer",
      company: "Globex",
      location: "Portugal",
      source: "Gupy",
      status: "applied",
      notes: "nota",
    });
  });

  it("cria, atualiza e remove vagas salvas", async () => {
    apiMock.post.mockResolvedValue({
      data: {
        id: "saved-1",
        jobLink: "https://example.com/job",
        jobTitle: "Frontend Developer",
        company: "ACME",
        location: "Remoto",
        source: "LinkedIn",
        keyword: "React",
        status: "saved",
        notes: "",
      },
    });
    apiMock.patch.mockResolvedValue({
      data: {
        id: "saved-1",
        jobLink: "https://example.com/job",
        jobTitle: "Frontend Developer",
        company: "ACME",
        location: "Remoto",
        source: "LinkedIn",
        keyword: "React",
        status: "applied",
        notes: "Atualizada",
      },
    });

    const created = await createDashboardSavedJob({
      id: "job-1",
      jobTitle: "Frontend Developer",
      company: "ACME",
      location: "Remoto",
      salary: "A combinar",
      type: "Remoto",
      level: "Pleno",
      matchScore: 90,
      tags: ["React"],
      posted: "Hoje",
      status: "saved",
      jobLink: "https://example.com/job",
      source: "LinkedIn",
      notes: "",
    });
    const updated = await updateDashboardSavedJob("saved-1", {
      status: "applied",
      notes: "Atualizada",
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      "/saved-jobs",
      expect.objectContaining({
        jobTitle: "Frontend Developer",
        company: "ACME",
        keyword: "React",
      }),
    );
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/saved-jobs/saved-1",
      expect.objectContaining({
        status: "applied",
        appliedAt: expect.any(String),
        notes: "Atualizada",
      }),
    );
    expect(created.jobTitle).toBe("Frontend Developer");
    expect(updated.status).toBe("applied");

    await deleteDashboardSavedJob("saved-1");
    expect(apiMock.delete).toHaveBeenCalledWith("/saved-jobs/saved-1");
  });

  it("normaliza perfis e preferencias do usuário", async () => {
    apiMock.get
      .mockResolvedValueOnce({
        data: {
          firstName: "Maria",
          lastName: "Clara",
          displayName: "Maria Clara",
          username: "mariaclara",
          email: "maria@exemplo.com",
          avatarUrl: "https://cdn.example.com/avatar.png",
          phone: "(11) 99999-9999",
          technologies: ["React"],
          level: "Pleno",
        },
      })
      .mockResolvedValueOnce({
        data: {
          keywords: ["React"],
          searchLocation: "Lisboa",
          remoteOnly: true,
          emailNotifications: false,
        },
      });

    const profile = await getUserProfile();
    const preferences = await getUserPreferences();

    expect(profile.avatarUrl).toBe("https://cdn.example.com/avatar.png");
    expect(preferences.searchLocation).toBe("Lisboa");
    expect(
      toUserProfile({
        displayName: "",
        email: "joana@exemplo.com",
        avatarUrl: null,
        technologies: [],
      }),
    ).toMatchObject({
      displayName: "joana",
      avatarUrl: "",
    });
    expect(
      toSearchPreferences({
        keywords: [],
        searchLocation: "",
        remoteOnly: null,
      }),
    ).toMatchObject({
      keywords: expect.arrayContaining(["React", "Frontend", "Fullstack"]),
    });
  });

  it("atualiza perfil e preferencias no backend", async () => {
    apiMock.patch
      .mockResolvedValueOnce({
        data: {
          displayName: "Maria Clara",
          firstName: "Maria",
          lastName: "Clara",
          username: "mariaclara",
          email: "maria@exemplo.com",
          avatarUrl: "https://cdn.example.com/avatar.png",
          phone: "(11) 99999-9999",
          technologies: ["React"],
          level: "Pleno",
        },
      })
      .mockResolvedValueOnce({
        data: {
          keywords: ["React"],
          searchLocation: "Brasil",
          remoteOnly: true,
          emailNotifications: true,
        },
      });

    const updatedProfile = await updateUserProfile({
      firstName: "Maria",
      lastName: "Clara",
      displayName: "Maria Clara",
      username: "mariaclara",
      email: "maria@exemplo.com",
      avatarUrl: "https://cdn.example.com/avatar.png",
      phone: "(11) 99999-9999",
      level: "Pleno",
      technologies: ["React"],
    });
    const updatedPreferences = await updateUserPreferences({
      keywords: ["React"],
      searchLocation: "Brasil",
      remoteOnly: true,
      emailNotifications: true,
    });

    expect(apiMock.patch).toHaveBeenCalledWith(
      "/users/profile",
      expect.objectContaining({
        avatarUrl: "https://cdn.example.com/avatar.png",
      }),
    );
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/users/preferences",
      expect.objectContaining({
        searchLocation: "Brasil",
      }),
    );
    expect(updatedProfile.displayName).toBe("Maria Clara");
    expect(updatedPreferences.remoteOnly).toBe(true);
  });

  it("faz fallback de url inválida ao mapear vaga recomendada", () => {
    const recommended = toRecommendedJob(
      {
        title: "Dev",
        company: "ACME",
        location: "Brasil",
        source: "LinkedIn",
        url: "not-a-url",
      },
      0,
    );

    expect(recommended.jobLink).toContain("canddate.local/jobs/");
    expect(recommended.rawPayload).toMatchObject({
      title: "Dev",
      company: "ACME",
    });
  });

  it("cobre inferência de modelo e link inválido em vagas salvas", async () => {
    expect(
      toRecommendedJob(
        {
          title: "Dev Remoto",
          company: "ACME",
          location: "Anywhere",
          modality: "home office",
          source: "LinkedIn",
          url: "https://example.com/a",
        },
        1,
      ).type,
    ).toBe("Remoto");
    expect(
      toRecommendedJob(
        {
          title: "Dev Híbrido",
          company: "ACME",
          location: "São Paulo",
          modality: "hybrid",
          source: "LinkedIn",
          url: "https://example.com/b",
        },
        2,
      ).type,
    ).toBe("Híbrido");
    expect(
      toRecommendedJob(
        {
          title: "Dev Presencial",
          company: "ACME",
          location: "São Paulo",
          source: "LinkedIn",
          url: "https://example.com/c",
        },
        3,
      ).type,
    ).toBe("Presencial");

    await expect(
      createDashboardSavedJob({
        jobTitle: "Frontend",
        company: "ACME",
        location: "Remoto",
        salary: "A combinar",
        type: "Remoto",
        level: "Pleno",
        tags: "React",
        source: "LinkedIn",
        jobLink: "link-invalido",
        notes: "",
      }),
    ).rejects.toThrow(/link válido/i);
  });

  it("não injeta appliedAt quando status não é aplicado", async () => {
    apiMock.patch.mockResolvedValue({
      data: {
        id: "saved-1",
        jobLink: "https://example.com/job",
        jobTitle: "Frontend Developer",
        company: "ACME",
        location: "Remoto",
        source: "LinkedIn",
        keyword: "React",
        status: "rejected",
        notes: "",
      },
    });

    await updateDashboardSavedJob("saved-1", {
      status: "rejected",
    });

    expect(apiMock.patch).toHaveBeenCalledWith(
      "/saved-jobs/saved-1",
      expect.not.objectContaining({
        appliedAt: expect.any(String),
      }),
    );
  });
});
