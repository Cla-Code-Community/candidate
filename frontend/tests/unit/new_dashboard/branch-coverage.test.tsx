import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CareerChecklist } from "@/domains/new_dashboard/components/home/CareerChecklist";
import { Header } from "@/domains/new_dashboard/components/layout/Header";
import { MessageDetailModal } from "@/domains/new_dashboard/components/layout/MessageDetailModal";
import { JobDetailModal } from "@/domains/new_dashboard/components/jobs/JobDetailModal";
import { JobRow } from "@/domains/new_dashboard/components/jobs/JobRow";
import { ProfileForm } from "@/domains/new_dashboard/components/profile/ProfileForm";
import { Modal } from "@/domains/new_dashboard/components/shared/Modal";
import {
  clearDashboardNotifications,
  getDashboardNotificationFeed,
  markDashboardNotificationsRead,
} from "@/domains/new_dashboard/infrastructure/notificationsApi";
import type { Job, UserProfile } from "@/domains/new_dashboard/types";
import { DASHBOARD_NOTIFICATIONS_REFRESH_EVENT } from "@/domains/new_dashboard/utils/notificationEvents";

const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();

vi.mock("@/domains/auth/application/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => mockUseTheme(),
}));

vi.mock("@/domains/new_dashboard/infrastructure/notificationsApi", () => ({
  getDashboardNotificationFeed: vi.fn().mockResolvedValue({
    messages: [],
    notifications: [],
    unreadCount: 0,
  }),
  markDashboardNotificationsRead: vi.fn().mockResolvedValue(undefined),
  clearDashboardNotifications: vi.fn().mockResolvedValue(undefined),
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
  technologyExperiences: [{ name: "React", years: 2 }],
};

describe("new_dashboard branch coverage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getDashboardNotificationFeed).mockReset();
    vi.mocked(markDashboardNotificationsRead).mockReset();
    vi.mocked(clearDashboardNotifications).mockReset();
    vi.mocked(getDashboardNotificationFeed).mockResolvedValue({
      messages: [],
      notifications: [],
      unreadCount: 0,
    } as never);
    vi.mocked(markDashboardNotificationsRead).mockResolvedValue(undefined);
    vi.mocked(clearDashboardNotifications).mockResolvedValue(undefined);
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

    fireEvent.click(screen.getByText("Julio Silva (Mentor)"));
    expect(
      screen.getByRole("heading", { name: "Julio Silva (Mentor)" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mentoria")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Fechar" })).toHaveLength(2);
  });

  it("carrega feeds reais, limpa alertas e abre menus do header autenticado", async () => {
    const logout = vi.fn();
    mockUseAuth.mockReturnValue({
      user: {
        email: "ana@exemplo.com",
        displayName: "Ana Souza",
        avatarUrl: "https://cdn.example.com/avatar.png",
      },
      logout,
    });
    vi.mocked(getDashboardNotificationFeed)
      .mockResolvedValueOnce({
        unreadCount: 1,
        messages: [
          {
            id: "message-api",
            sender: "RH Candidate",
            text: "Podemos falar hoje?",
            date: "Há 2 min",
            origin: "recruiter",
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        unreadCount: 1,
        notifications: [
          {
            id: "notification-api",
            text: "React Developer tem 91% de compatibilidade.",
            type: "match",
            date: "Há 1 min",
          },
        ],
      } as never)
      .mockResolvedValue({
        messages: [],
        notifications: [],
        unreadCount: 0,
      } as never);

    renderWithRouter(<Header />);

    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar de Ana Souza")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Mensagens"));
    expect(screen.getByText("Podemos falar hoje?")).toBeInTheDocument();
    expect(markDashboardNotificationsRead).toHaveBeenCalledWith("message");

    fireEvent.click(screen.getByText("RH Candidate"));
    expect(
      screen.getByRole("heading", { name: "RH Candidate" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recrutador")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);

    fireEvent.click(screen.getByLabelText("Notificações"));
    expect(
      screen.getByText("React Developer tem 91% de compatibilidade."),
    ).toBeInTheDocument();
    expect(markDashboardNotificationsRead).toHaveBeenCalledWith("notification");

    fireEvent.click(screen.getByText("Limpar"));
    expect(clearDashboardNotifications).toHaveBeenCalledWith("notification");
    expect(
      screen.queryByText("React Developer tem 91% de compatibilidade."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Menu do usuário"));
    fireEvent.click(screen.getByText("Sair da Conta"));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("inclui notificação local recebida por evento sem depender de reload", async () => {
    mockUseAuth.mockReturnValue({
      user: { email: "ana@exemplo.com", name: "Ana" },
      logout: vi.fn(),
    });

    renderWithRouter(<Header notifications={[]} unreadNotifications={0} />);

    window.dispatchEvent(
      new CustomEvent(DASHBOARD_NOTIFICATIONS_REFRESH_EVENT, {
        detail: {
          channel: "notification",
          incrementUnread: true,
          item: {
            id: "local:apply",
            text: "Sua candidatura foi registrada.",
            type: "success",
            date: "Agora",
          },
        },
      }),
    );

    fireEvent.click(screen.getByLabelText("Notificações"));

    await waitFor(() => {
      expect(
        screen.getByText("Sua candidatura foi registrada."),
      ).toBeInTheDocument();
    });
  });

  it("renderiza modal compartilhado sem subtítulo nem rodapé", () => {
    const onClose = vi.fn();

    render(
      <Modal title="Modal simples" onClose={onClose}>
        <p>Conteúdo direto</p>
      </Modal>,
    );

    expect(screen.getByRole("heading", { name: "Modal simples" })).toBeInTheDocument();
    expect(screen.getByText("Conteúdo direto")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("usa origem sistema como fallback no detalhe da mensagem", () => {
    render(
      <MessageDetailModal
        message={{
          id: "message-system",
          sender: "Candidate",
          text: "Seu resumo semanal está pronto.",
          date: "Agora",
        }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Sistema")).toBeInTheDocument();
    expect(screen.getByText("Seu resumo semanal está pronto.")).toBeInTheDocument();
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
