/* eslint-disable @typescript-eslint/no-explicit-any */
import NewDashboardPage from "@/domains/new_dashboard/NewDashboardPage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* -------------------------------------------------------------------------- */
/*                              MOCKS DE MÓDULOS                              */
/*         ⚠️  caminhos SEMPRE com alias @/domains/new_dashboard/...           */
/*         porque vi.mock resolve relativo ao ARQUIVO DE TESTE.               */
/* -------------------------------------------------------------------------- */

const mockNavigate = vi.fn();
let mockPathname = "/";
const mockSetSearchParams = vi.fn();
let mockSearchParamsValue = new URLSearchParams();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: () => ({ pathname: mockPathname }),
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParamsValue, mockSetSearchParams],
  };
});

const mockRefreshUser = vi.fn().mockResolvedValue(undefined);
vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Tester" },
    refreshUser: mockRefreshUser,
  }),
}));

// ---------- Child components (paths com alias!) ----------
vi.mock("@/domains/new_dashboard/components/dashboard/DashboardTab", () => ({
  DashboardTab: (props: any) => (
    <div data-testid="dashboard-tab">
      <button onClick={() => props.onOpenJob({ id: "job-1" })}>dash-open</button>
      <button onClick={() => props.onStatusChange("job-1", "applied")}>
        dash-status
      </button>
      <button onClick={props.onAddJob}>dash-add</button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/help/HelpTab", () => ({
  HelpTab: () => <div data-testid="help-tab">Help</div>,
}));

vi.mock("@/domains/new_dashboard/components/home/HomeTab", () => ({
  HomeTab: (props: any) => (
    <div data-testid="home-tab">
      <button onClick={() => props.onCareerChecklistChange([{ id: "c1" }])}>
        home-checklist
      </button>
      <button onClick={props.onExploreJobs}>home-explore</button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/jobs/AddJobModal", () => ({
  AddJobModal: (props: any) => (
    <div data-testid="add-job-modal">
      <button onClick={() => props.onAddJob({ title: "new" })}>add-submit</button>
      <button onClick={props.onClose}>add-close</button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/jobs/JobDetailModal", () => ({
  JobDetailModal: (props: any) => (
    <div data-testid="job-detail-modal">
      <span data-testid="detail-job-id">{props.job.id}</span>
      <button onClick={() => props.onClose()}>detail-close</button>
      <button onClick={() => props.onStatusChange(props.job.id, "applied")}>
        detail-status
      </button>
      <button onClick={() => props.onNotesChange(props.job.id, "note")}>
        detail-notes
      </button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/jobs/JobTab", () => ({
  JobTab: (props: any) => (
    <div data-testid="job-tab">
      <button onClick={() => props.setSearchQuery("react")}>set-search</button>
      <button onClick={() => props.setFilterType("Remoto")}>set-type</button>
      <button onClick={() => props.setFilterLevel("Junior")}>set-level</button>
      <button onClick={() => props.setContinentFilter("América")}>
        set-continent
      </button>
      <button onClick={() => props.setCountryFilter("Brasil")}>set-country</button>
      <button onClick={() => props.setMatchSort("best")}>set-sort</button>
      <button onClick={() => props.onSearchJobs()}>jobtab-search</button>
      <button onClick={() => props.onPageChange(2)}>jobtab-page</button>
      <button onClick={() => props.onPageSizeChange(20)}>jobtab-size</button>
      <button onClick={() => props.onOpenJob({ id: "rec-1" })}>open-rec</button>
      <button onClick={() => props.onStatusChange("rec-1", "applied")}>
        rec-status
      </button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/mentoring/MentoringTab", () => ({
  MentoringTab: () => <div data-testid="mentoring-tab" />,
}));

vi.mock("@/domains/new_dashboard/components/profile/ProfileTab", () => ({
  ProfileTab: (props: any) => (
    <div data-testid="profile-tab">
      <button onClick={() => props.onSaveProfile({ name: "x" })}>save-profile</button>
      <button onClick={() => props.onSavePreferences({ jobTypes: ["Remoto"] })}>
        save-prefs
      </button>
    </div>
  ),
}));

vi.mock("@/domains/new_dashboard/components/layout/Header", () => ({
  Header: () => <div data-testid="header" />,
}));
vi.mock("@/domains/new_dashboard/components/layout/MobileTabBar", () => ({
  MobileTabBar: () => <div data-testid="mobile-tab-bar" />,
}));
vi.mock("@/domains/new_dashboard/components/layout/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("@/domains/new_dashboard/components/shared/Toast", () => ({
  Toast: ({ message }: any) =>
    message ? <div data-testid="toast">{message}</div> : null,
}));

vi.mock("@/domains/new_dashboard/constants", () => ({
  jobStatuses: { applied: "Aplicada", interview: "Entrevista" },
}));

vi.mock("@/domains/new_dashboard/utils/searchKeywords", () => ({
  parseSearchKeywords: (s: string) =>
    s ? s.split(",").map((x) => x.trim()) : [],
}));

vi.mock("@/domains/new_dashboard/utils/jobModelFilters", () => ({
  getModelFilterFromJobTypes: (types: string[]) =>
    types.includes("Remoto") ? "Remoto" : "Todos",
  modelFilterToApiFilter: (f: string) => (f === "Todos" ? {} : { model: f }),
}));

vi.mock("@/domains/new_dashboard/utils/locationFilters", () => ({}));

// ---------- Hooks ----------
const mockSetUserProfile = vi.fn();
const mockSetSearchPreferences = vi.fn();
const mockSaveUserProfile = vi.fn().mockResolvedValue(undefined);
const mockSaveSearchPreferences = vi.fn().mockResolvedValue(undefined);

let mockUserData: any = {};

vi.mock("@/domains/new_dashboard/hooks/useUserDashboardData", () => ({
  useUserDashboardData: () => mockUserData,
}));

const mockRefreshRecommendations = vi.fn().mockResolvedValue(undefined);
const mockAddTrackedJob = vi.fn().mockResolvedValue(undefined);
const mockChangeJobStatus = vi
  .fn()
  .mockImplementation((id: string, status: string) =>
    Promise.resolve({ id, status }),
  );
const mockChangeJobNotesLocally = vi.fn();
const mockSaveJobNotes = vi.fn().mockResolvedValue(undefined);

let mockJobs: any = {};

vi.mock("@/domains/new_dashboard/hooks/useDashboardJobs", () => ({
  useDashboardJobs: () => mockJobs,
}));

/* -------------------------------------------------------------------------- */
/*                              FACTORIES                                     */
/* -------------------------------------------------------------------------- */

function defaultJobs(overrides: any = {}) {
  mockJobs = {
    trackedJobs: [],
    recommendedJobs: [],
    recommendedPagination: { page: 1, limit: 10, total: 0 },
    isRefreshingJobs: false,
    refreshRecommendations: mockRefreshRecommendations,
    addTrackedJob: mockAddTrackedJob,
    changeJobStatus: mockChangeJobStatus,
    changeJobNotesLocally: mockChangeJobNotesLocally,
    saveJobNotes: mockSaveJobNotes,
    ...overrides,
  };
}

function defaultUserData(overrides: any = {}) {
  mockUserData = {
    userProfile: { technologyExperiences: [] },
    setUserProfile: mockSetUserProfile,
    searchPreferences: { jobTypes: [], careerChecklist: [] },
    setSearchPreferences: mockSetSearchPreferences,
    isLoadingUserData: false,
    isSavingProfile: false,
    isSavingPreferences: false,
    saveUserProfile: mockSaveUserProfile,
    saveSearchPreferences: mockSaveSearchPreferences,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname = "/";
  mockSearchParamsValue = new URLSearchParams();
  defaultJobs();
  defaultUserData();
});

afterEach(() => {
  vi.useRealTimers();
});

/* ========================================================================== */
/*  A PARTIR DAQUI, O CORPO DOS TESTES É IDÊNTICO AO QUE VOCÊ JÁ TINHA       */
/*  (só as chamadas de vi.mock acima precisavam mudar de caminho)             */
/* ========================================================================== */

describe("NewDashboardPage - roteamento por section", () => {
  it.each([
    ["/dashboard", "dashboard-tab"],
    ["/vagas", "job-tab"],
    ["/mentoria", "mentoring-tab"],
    ["/perfil", "profile-tab"],
    ["/ajuda", "help-tab"],
    ["/", "home-tab"],
    ["/desconhecido", "home-tab"],
  ])("renderiza a tab correta para %s", (pathname, testId) => {
    mockPathname = pathname;
    render(<NewDashboardPage />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-tab-bar")).toBeInTheDocument();
  });
});

describe("NewDashboardPage - jobId via URL", () => {
  it("sincroniza jobId da URL, abre modal e limpa o parâmetro", async () => {
    mockSearchParamsValue = new URLSearchParams("jobId=abc");
    const trackedJob = {
      id: "abc",
      jobTitle: "Dev",
      company: "X",
      location: "BR",
      type: "full-time",
      level: "senior",
      tags: [],
      rawPayload: {},
      matchScore: 90,
    } as any;
    defaultJobs({ trackedJobs: [trackedJob] });

    render(<NewDashboardPage />);

    await waitFor(() =>
      expect(screen.getByTestId("job-detail-modal")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("detail-job-id").textContent).toBe("abc");
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it("não faz nada quando não há jobId na URL", () => {
    render(<NewDashboardPage />);
    expect(screen.queryByTestId("job-detail-modal")).not.toBeInTheDocument();
    expect(mockSetSearchParams).not.toHaveBeenCalled();
  });
});

describe("NewDashboardPage - scoreJobWithTechnologies (via DashboardTab)", () => {
  const baseJob = (overrides: any = {}) => ({
    id: "j1",
    jobTitle: "Frontend Developer",
    company: "ACME",
    location: "Brasil",
    type: "full-time",
    level: "senior",
    tags: ["react", "typescript"],
    rawPayload: {},
    matchScore: 0,
    ...overrides,
  });

  it("mantém score quando rawPayload.matchSource é backend_profile", () => {
    defaultJobs({
      trackedJobs: [
        baseJob({
          matchScore: 88,
          rawPayload: { matchSource: "backend_profile" },
        }),
      ],
    });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("retorna job inalterado quando não há tecnologias", () => {
    defaultJobs({ trackedJobs: [baseJob()] });
    mockUserData.userProfile.technologyExperiences = [];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("ignora tecnologias com nome vazio (branch filter)", () => {
    defaultJobs({ trackedJobs: [baseJob()] });
    mockUserData.userProfile.technologyExperiences = [
      { name: "  ", years: 3 },
      { name: "React", years: 5 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("atribui score 45 quando nenhuma tecnologia casa", () => {
    defaultJobs({ trackedJobs: [baseJob({ tags: [] })] });
    mockUserData.userProfile.technologyExperiences = [
      { name: "cobol", years: 5 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("calcula score com tecnologias casadas e cobre aliases js", () => {
    defaultJobs({
      trackedJobs: [
        baseJob({
          jobTitle: "Vaga Node js",
          tags: ["Node JS"],
          rawPayload: { description: "React and Vue" },
        }),
      ],
    });
    mockUserData.userProfile.technologyExperiences = [
      { name: "Node js", years: 4 },
      { name: "react", years: 3 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("cobre branch matchAliases com 'js' no final (<- ' js')", () => {
    defaultJobs({
      trackedJobs: [baseJob({ jobTitle: "Dev", tags: [] })],
    });
    mockUserData.userProfile.technologyExperiences = [
      { name: "nodejs", years: 2 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("cobre textMatchesAlias com aliases contendo espaço", () => {
    defaultJobs({
      trackedJobs: [
        baseJob({
          jobTitle: "Vaga de node js sênior",
          tags: [],
          rawPayload: {},
        }),
      ],
    });
    mockUserData.userProfile.technologyExperiences = [
      { name: "node js", years: 3 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("cobre rawPayload com arrays e valores não-string", () => {
    defaultJobs({
      trackedJobs: [
        baseJob({
          rawPayload: {
            lista: ["react", "vue"],
            numero: 42,
            nulo: null,
            texto: "graphql",
          },
        }),
      ],
    });
    mockUserData.userProfile.technologyExperiences = [
      { name: "react", years: 3 },
    ];
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("dashboard-tab")).toBeInTheDocument();
  });

  it("não recalcula score em recommendedJobs quando matchScore > 0", () => {
    defaultJobs({
      recommendedJobs: [
        {
          id: "r1",
          jobTitle: "Dev",
          company: "C",
          location: "BR",
          type: "full-time",
          level: "jr",
          tags: [],
          rawPayload: {},
          matchScore: 77,
        },
      ],
    });
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("job-tab")).toBeInTheDocument();
  });

  it("recalcula score em recommendedJobs quando matchScore = 0", () => {
    defaultJobs({
      recommendedJobs: [
        {
          id: "r1",
          jobTitle: "Dev React",
          company: "C",
          location: "BR",
          type: "full-time",
          level: "jr",
          tags: [],
          rawPayload: {},
          matchScore: 0,
        },
      ],
    });
    mockUserData.userProfile.technologyExperiences = [
      { name: "react", years: 2 },
    ];
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    expect(screen.getByTestId("job-tab")).toBeInTheDocument();
  });
});

describe("NewDashboardPage - toast e timers", () => {
  it("mostra e limpa toast após 3s", async () => {
    vi.useFakeTimers();
    defaultJobs({
      changeJobStatus: vi
        .fn()
        .mockResolvedValue({ id: "job-1", status: "applied" }),
    });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);

    fireEvent.click(screen.getByText("dash-status"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("toast")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId("toast")).not.toBeInTheDocument();
  });

  it("limpa timeout de checklist ao desmontar", () => {
    mockPathname = "/";
    const { unmount } = render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("home-checklist"));
    unmount();
  });

  it("reutiliza timeout de checklist em mudanças consecutivas", () => {
    vi.useFakeTimers();
    mockPathname = "/";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("home-checklist"));
    fireEvent.click(screen.getByText("home-checklist"));
    act(() => {
      vi.advanceTimersByTime(700);
    });
  });
});

describe("NewDashboardPage - handlers de perfil/preferências", () => {
  beforeEach(() => {
    mockPathname = "/perfil";
  });

  it("salva perfil com sucesso e mostra toast", async () => {
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("save-profile"));
    });
    await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalled());
    expect(mockRefreshUser).toHaveBeenCalled();
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Perfil atualizado com sucesso.",
    );
  });

  it("trata erro ao salvar perfil", async () => {
    mockSaveUserProfile.mockRejectedValueOnce(new Error("fail"));
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("save-profile"));
    });
    await waitFor(() => expect(mockSaveUserProfile).toHaveBeenCalled());
  });

  it("salva preferências com sucesso", async () => {
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("save-prefs"));
    });
    await waitFor(() => expect(mockSaveSearchPreferences).toHaveBeenCalled());
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Preferências de busca atualizadas.",
    );
  });

  it("trata erro ao salvar preferências", async () => {
    mockSaveSearchPreferences.mockRejectedValueOnce(new Error("fail"));
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("save-prefs"));
    });
    await waitFor(() => expect(mockSaveSearchPreferences).toHaveBeenCalled());
  });
});

describe("NewDashboardPage - filtros e busca", () => {
  beforeEach(() => {
    mockPathname = "/vagas";
  });

  it("chama onSearchJobs quando clicado", async () => {
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-search"));
    });
    expect(mockRefreshRecommendations).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      1,
    );
  });

  it("trata erro em onSearchJobs", async () => {
    mockRefreshRecommendations.mockRejectedValueOnce(new Error("fail"));
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-search"));
    });
  });

  it("chama onPageChange", async () => {
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-page"));
    });
    expect(mockRefreshRecommendations).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      2,
      expect.any(Number),
    );
  });

  it("trata erro em onPageChange", async () => {
    mockRefreshRecommendations.mockRejectedValueOnce(new Error("fail"));
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-page"));
    });
  });

  it("chama onPageSizeChange", async () => {
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-size"));
    });
    expect(mockRefreshRecommendations).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Object),
      1,
      20,
    );
  });

  it("trata erro em onPageSizeChange", async () => {
    mockRefreshRecommendations.mockRejectedValueOnce(new Error("fail"));
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-size"));
    });
  });

  it("dispara busca automática com debounce ao mudar filtros", async () => {
    vi.useFakeTimers();
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("set-search"));
    fireEvent.click(screen.getByText("set-type"));
    fireEvent.click(screen.getByText("set-level"));
    fireEvent.click(screen.getByText("set-continent"));
    fireEvent.click(screen.getByText("set-country"));
    fireEvent.click(screen.getByText("set-sort"));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(mockRefreshRecommendations).toHaveBeenCalled();
  });
});

describe("NewDashboardPage - status / notas / jobs", () => {
  it("altera status com job aberto (re-seleciona)", async () => {
    const job = {
      id: "job-1",
      jobTitle: "Dev",
      company: "X",
      location: "BR",
      type: "ft",
      level: "sr",
      tags: [],
      rawPayload: {},
      matchScore: 80,
    } as any;
    defaultJobs({ trackedJobs: [job] });
    mockChangeJobStatus.mockResolvedValueOnce({ id: "job-1", status: "applied" });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);

    fireEvent.click(screen.getByText("dash-open"));
    await act(async () => {
      fireEvent.click(screen.getByText("detail-status"));
    });
    await waitFor(() => expect(mockChangeJobStatus).toHaveBeenCalled());
  });

  it("altera status sem modal aberto (job não selecionado)", async () => {
    defaultJobs({
      recommendedJobs: [
        {
          id: "rec-1",
          jobTitle: "Dev",
          company: "X",
          location: "BR",
          type: "ft",
          level: "sr",
          tags: [],
          rawPayload: {},
          matchScore: 70,
        } as any,
      ],
    });
    mockChangeJobStatus.mockResolvedValueOnce({ id: "rec-1", status: "applied" });
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("rec-status"));
    });
    await waitFor(() => expect(mockChangeJobStatus).toHaveBeenCalled());
  });

  it("trata erro em changeJobStatus", async () => {
    mockChangeJobStatus.mockRejectedValueOnce(new Error("fail"));
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    await act(async () => {
      fireEvent.click(screen.getByText("rec-status"));
    });
  });

  it("propaga onNotesChange", async () => {
    const job = {
      id: "job-1",
      jobTitle: "Dev",
      company: "X",
      location: "BR",
      type: "ft",
      level: "sr",
      tags: [],
      rawPayload: {},
      matchScore: 80,
    } as any;
    defaultJobs({ trackedJobs: [job] });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-open"));
    fireEvent.click(screen.getByText("detail-notes"));
    expect(mockChangeJobNotesLocally).toHaveBeenCalledWith("job-1", "note");
  });

  it("handleCloseJob persiste notas do job selecionado", async () => {
    const job = {
      id: "job-1",
      jobTitle: "Dev",
      company: "X",
      location: "BR",
      type: "ft",
      level: "sr",
      tags: [],
      rawPayload: {},
      matchScore: 80,
    } as any;
    defaultJobs({ trackedJobs: [job] });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-open"));
    await act(async () => {
      fireEvent.click(screen.getByText("detail-close"));
    });
    expect(mockSaveJobNotes).toHaveBeenCalled();
  });

  it("handleCloseJob não persiste quando não há job selecionado", async () => {
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    expect(mockSaveJobNotes).not.toHaveBeenCalled();
  });

  it("handleCloseJob trata erro em saveJobNotes", async () => {
    mockSaveJobNotes.mockRejectedValueOnce(new Error("fail"));
    const job = {
      id: "job-1",
      jobTitle: "Dev",
      company: "X",
      location: "BR",
      type: "ft",
      level: "sr",
      tags: [],
      rawPayload: {},
      matchScore: 80,
    } as any;
    defaultJobs({ trackedJobs: [job] });
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-open"));
    await act(async () => {
      fireEvent.click(screen.getByText("detail-close"));
    });
  });
});

describe("NewDashboardPage - adicionar vaga", () => {
  it("abre modal via DashboardTab e adiciona vaga", async () => {
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-add"));
    expect(screen.getByTestId("add-job-modal")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("add-submit"));
    });
    expect(mockAddTrackedJob).toHaveBeenCalled();
    expect(screen.getByTestId("toast")).toHaveTextContent(
      "Vaga adicionada às suas oportunidades.",
    );
  });

  it("fecha modal sem adicionar", () => {
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-add"));
    fireEvent.click(screen.getByText("add-close"));
    expect(screen.queryByTestId("add-job-modal")).not.toBeInTheDocument();
  });

  it("trata erro ao adicionar vaga", async () => {
    mockAddTrackedJob.mockRejectedValueOnce(new Error("fail"));
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("dash-add"));
    await act(async () => {
      fireEvent.click(screen.getByText("add-submit"));
    });
  });
});

describe("NewDashboardPage - navegação HomeTab", () => {
  it("navega para /vagas ao explorar vagas", () => {
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("home-explore"));
    expect(mockNavigate).toHaveBeenCalledWith("/vagas");
  });
});

describe("NewDashboardPage - preferências (efetivo do modelo)", () => {
  it("aplica preferredModelFilter quando usuário não alterou filtros", () => {
    mockPathname = "/vagas";
    mockUserData.searchPreferences = {
      jobTypes: ["Remoto"],
      careerChecklist: [],
    };
    render(<NewDashboardPage />);
    expect(screen.getByTestId("job-tab")).toBeInTheDocument();
  });

  it("não sobrescreve filterType após o usuário escolher manualmente", async () => {
    mockPathname = "/vagas";
    mockUserData.searchPreferences = {
      jobTypes: ["Remoto"],
      careerChecklist: [],
    };
    const { rerender } = render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("set-type"));
    mockUserData.searchPreferences = {
      jobTypes: [],
      careerChecklist: [],
    };
    rerender(<NewDashboardPage />);
    expect(screen.getByTestId("job-tab")).toBeInTheDocument();
  });

  it("não aplica preferredModelFilter enquanto isLoadingUserData = true", () => {
    mockPathname = "/vagas";
    mockUserData.isLoadingUserData = true;
    mockUserData.searchPreferences = {
      jobTypes: ["Remoto"],
      careerChecklist: [],
    };
    render(<NewDashboardPage />);
    expect(screen.getByTestId("job-tab")).toBeInTheDocument();
  });
});

describe("NewDashboardPage - useEffect de busca automática - bordas", () => {
  it("não dispara busca em seções que não são /vagas", async () => {
    vi.useFakeTimers();
    mockPathname = "/dashboard";
    render(<NewDashboardPage />);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockRefreshRecommendations).not.toHaveBeenCalled();
  });

  it("primeira execução em /vagas é pulada", async () => {
    vi.useFakeTimers();
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockRefreshRecommendations).not.toHaveBeenCalled();
  });
});

describe("NewDashboardPage - buildRecommendationSearch com todos os filtros", () => {
  it("aplica todos os filtros na busca", async () => {
    mockPathname = "/vagas";
    render(<NewDashboardPage />);
    fireEvent.click(screen.getByText("set-search"));
    fireEvent.click(screen.getByText("set-level"));
    fireEvent.click(screen.getByText("set-continent"));
    fireEvent.click(screen.getByText("set-country"));
    fireEvent.click(screen.getByText("set-sort"));
    await act(async () => {
      fireEvent.click(screen.getByText("jobtab-search"));
    });
    expect(mockRefreshRecommendations).toHaveBeenCalledWith(
      ["react"],
      expect.objectContaining({
        level: "Junior",
        continent: "América",
        country: "Brasil",
        location: "Brasil",
        matchSort: "best",
      }),
      1,
    );
  });
});