import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CareerChecklist } from "@/domains/new_dashboard/components/home/CareerChecklist";
import { Header } from "@/domains/new_dashboard/components/layout/Header";
import { JobDetailModal } from "@/domains/new_dashboard/components/jobs/JobDetailModal";
import { JobRow } from "@/domains/new_dashboard/components/jobs/JobRow";
import { ProfileForm } from "@/domains/new_dashboard/components/profile/ProfileForm";
import type { Job, UserProfile } from "@/domains/new_dashboard/types";

const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => mockUseTheme(),
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const baseJob: Job = {
  id: "job-1",
  jobTitle: "Frontend Developer",
  company: "ACME",
  location: "Remoto",
  salary: "A combinar",
  type: "Remoto",
  level: "Pleno",
  matchScore: 88,
  tags: ["React"],
  posted: "Hoje",
  status: "saved",
  jobLink: "https://example.com/job-1",
  source: "LinkedIn",
  notes: "",
  rawPayload: {},
};

const profileWithoutAvatar: UserProfile = {
  firstName: "Bruna",
  lastName: "Silva",
  displayName: "Bruna Silva",
  username: "brunas",
  email: "bruna@exemplo.com",
  avatarUrl: "",
  phone: "(11) 99999-9999",
  level: "Pleno",
  technologies: ["React"],
};

describe("new_dashboard branch coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseAuth.mockReturnValue({
      user: null,
      logout: vi.fn(),
    });
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      toggleTheme: vi.fn(),
    });
  });

  it("cobre fallback do header sem usuário e menus vazios", () => {
    renderWithRouter(<Header />);

    expect(screen.getByLabelText("Mensagens")).toBeInTheDocument();
    expect(screen.getByLabelText("Notificações")).toBeInTheDocument();
    expect(screen.getByLabelText("Menu do usuário")).toBeInTheDocument();
    expect(screen.getByText("Usuário")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Mensagens"));
    expect(screen.getByText(/lidas/i)).toBeInTheDocument();
  });

  it("mantém o avatar por iniciais e evita tecnologias duplicadas no perfil", () => {
    const setUserProfile = vi.fn();

    render(
      <ProfileForm
        userProfile={profileWithoutAvatar}
        setUserProfile={setUserProfile}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText("BS")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/adicionar tecnologia/i), {
      target: { value: "React" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));

    expect(setUserProfile).toHaveBeenCalled();
    expect(screen.getAllByText("React")).toHaveLength(1);
  });

  it("usa o checklist com título padrão, enter e remoção da lista", () => {
    render(<CareerChecklist />);

    expect(
      screen.getByText(/crie uma lista mensal para começar/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^lista$/i }));
    expect(
      screen.getByRole("button", { name: /checklist de julho de 2026/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/novo item do checklist/i), {
      target: { value: "Ler documentação" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/novo item do checklist/i), {
      key: "Enter",
      code: "Enter",
    });

    expect(screen.getByText("Ler documentação")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /excluir lista/i }));
    expect(
      screen.getByText(/crie uma lista mensal para começar/i),
    ).toBeInTheDocument();
  });

  it("oculta payload e descrição quando a vaga nao possui esses campos", () => {
    render(
      <JobDetailModal
        job={{ ...baseJob, rawPayload: {}, notes: "" }}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onNotesChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/payload da vaga/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/descrição/i)).not.toBeInTheDocument();
  });

  it("normaliza fonte desconhecida e fonte ausente na linha de vaga", () => {
    const onOpen = vi.fn();
    const onStatusChange = vi.fn();

    render(
      <table>
        <tbody>
          <JobRow
            job={{ ...baseJob, source: "MysteryBoard" }}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
          />
          <JobRow
            job={{ ...baseJob, id: "job-2", source: "" }}
            onOpen={onOpen}
            onStatusChange={onStatusChange}
          />
        </tbody>
      </table>,
    );

    expect(screen.getByText("MysteryBoard")).toBeInTheDocument();
    expect(screen.getByText("Não informada")).toBeInTheDocument();
  });
});
