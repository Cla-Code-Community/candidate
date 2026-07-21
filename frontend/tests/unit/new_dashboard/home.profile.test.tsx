import { CareerChecklist } from "@/domains/new_dashboard/components/home/CareerChecklist";
import { HomeTab } from "@/domains/new_dashboard/components/home/HomeTab";
import { PreferencesForm } from "@/domains/new_dashboard/components/profile/PreferencesForm";
import { ProfileForm } from "@/domains/new_dashboard/components/profile/ProfileForm";
import {
  initialPreferences,
  initialUser,
} from "@/domains/new_dashboard/constants";
import type {
  SearchPreferences,
  UserProfile,
} from "@/domains/new_dashboard/types";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function renderWithProfileState(
  ui: (props: {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    onSave: (userProfile: UserProfile) => Promise<void>;
  }) => ReactElement,
) {
  const onSave = vi.fn();

  function Harness() {
    const [userProfile, setUserProfile] = useState<UserProfile>(initialUser);

    return ui({ userProfile, setUserProfile, onSave });
  }

  render(<Harness />);

  return { onSave };
}

function renderWithPreferencesState(
  ui: (props: {
    searchPreferences: SearchPreferences;
    setSearchPreferences: React.Dispatch<
      React.SetStateAction<SearchPreferences>
    >;
    onSave: (searchPreferences: SearchPreferences) => Promise<void>;
  }) => ReactElement,
) {
  const onSave = vi.fn();

  function Harness() {
    const [searchPreferences, setSearchPreferences] =
      useState<SearchPreferences>(initialPreferences);

    return ui({ searchPreferences, setSearchPreferences, onSave });
  }

  render(<Harness />);

  return { onSave };
}

describe("new_dashboard home and profile components", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza o banner e a lista de vagas salvas recentes no HomeTab", () => {
    render(
      <HomeTab
        userProfile={initialUser}
        jobs={[
          {
            id: "1",
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
            jobLink: "https://example.com",
            source: "LinkedIn",
            notes: "",
          },
          {
            id: "2",
            jobTitle: "Backend Developer",
            company: "Globex",
            location: "Brasil",
            salary: "A combinar",
            type: "Híbrido",
            level: "Sênior",
            matchScore: 91,
            tags: ["Node.js"],
            posted: "Ontem",
            status: "applied",
            jobLink: "https://example.com/2",
            source: "Gupy",
            notes: "",
          },
        ]}
        onExploreJobs={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /que bom te ver de volta/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
    expect(screen.getByText("Backend Developer")).toBeInTheDocument();
    expect(screen.getByText("Candidatura enviada")).toBeInTheDocument();
  });

  it("mostra estado vazio no HomeTab quando não há vagas", () => {
    const onExploreJobs = vi.fn();

    render(
      <HomeTab
        userProfile={initialUser}
        jobs={[]}
        onExploreJobs={onExploreJobs}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /buscar vagas/i }));

    expect(onExploreJobs).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/nenhuma vaga salva ainda/i)).toBeInTheDocument();
  });

  it("permite criar lista, adicionar item, marcar e excluir no CareerChecklist", () => {
    render(<CareerChecklist />);

    fireEvent.change(screen.getByPlaceholderText(/nome da nova lista/i), {
      target: { value: "Metas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^lista$/i }));

    expect(screen.getByRole("button", { name: /metas/i })).toBeInTheDocument();
    expect(
      screen.getByText("julho de 2026", { selector: "span" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/novo item do checklist/i), {
      target: { value: "Conseguir entrevistas" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^item$/i }));

    const itemLabel = screen.getByText("Conseguir entrevistas");
    expect(itemLabel).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(itemLabel).toHaveClass("line-through");

    fireEvent.click(screen.getByRole("button", { name: /excluir item/i }));
    expect(screen.queryByText("Conseguir entrevistas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /excluir lista/i }));
    expect(
      screen.getByText(/crie uma lista mensal para começar/i),
    ).toBeInTheDocument();
  });

  it("edita e salva o perfil com avatar, tecnologias e campos auxiliares", async () => {
    const saveProfile = vi.fn();

    renderWithProfileState(({ userProfile, setUserProfile }) => (
      <ProfileForm
        userProfile={userProfile}
        setUserProfile={setUserProfile}
        onSave={saveProfile}
      />
    ));

    fireEvent.change(screen.getByPlaceholderText("https://..."), {
      target: { value: "https://cdn.example.com/avatar.png" },
    });
    fireEvent.change(screen.getByPlaceholderText(/adicionar tecnologia/i), {
      target: { value: "React Query" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.change(screen.getByPlaceholderText(/adicionar tecnologia/i), {
      target: { value: "React Query" },
    });
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /remover react query/i }),
    );
    fireEvent.change(screen.getByDisplayValue(initialUser.level), {
      target: { value: "Sênior" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações/i }));

    expect(screen.getByAltText(/avatar de/i)).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png",
    );
    expect(screen.queryByText("React Query")).not.toBeInTheDocument();
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarUrl: "https://cdn.example.com/avatar.png",
        level: "Sênior",
        technologies: initialUser.technologies,
      }),
    );
  });

  it("edita e salva as preferências de busca", () => {
    const savePreferences = vi.fn();

    renderWithPreferencesState(
      ({ searchPreferences, setSearchPreferences }) => (
        <PreferencesForm
          searchPreferences={searchPreferences}
          setSearchPreferences={setSearchPreferences}
          onSave={savePreferences}
        />
      ),
    );

    fireEvent.change(screen.getByLabelText(/localidade principal de busca/i), {
      target: { value: "Lisboa, Portugal" },
    });
    fireEvent.change(screen.getByLabelText(/vagas exibidas inicialmente/i), {
      target: { value: "RemotoHibrido" },
    });
    fireEvent.click(
      screen.getByLabelText(/habilitar alertas de vagas no e-mail/i),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /salvar preferências/i }),
    );

    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        searchLocation: "Lisboa, Portugal",
        remoteOnly: false,
        jobTypes: ["Remoto", "Híbrido"],
        emailNotifications: false,
      }),
    );
  });
});
