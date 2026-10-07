import { ProfileTab } from "@/domains/new_dashboard/components/profile/ProfileTab";
import type {
  SearchPreferences,
  UserProfile,
} from "@/domains/new_dashboard/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/new_dashboard/components/profile/ProfileForm", () => ({
  ProfileForm: () => <div data-testid="profile-form" />,
}));
vi.mock("@/domains/new_dashboard/components/profile/PreferencesForm", () => ({
  PreferencesForm: () => <div data-testid="preferences-form" />,
}));
vi.mock("@/domains/new_dashboard/components/profile/ConnectionsForm", () => ({
  ConnectionsForm: () => <div data-testid="connections-form" />,
}));
vi.mock("@/domains/new_dashboard/components/profile/GenerateResumeCard", () => ({
  GenerateResumeCard: () => <div data-testid="generate-resume-card" />,
}));

const userProfile = {} as UserProfile;
const searchPreferences = {} as SearchPreferences;

describe("ProfileTab", () => {
  it("renderiza todas as seções, incluindo o gerador de currículo", () => {
    render(
      <ProfileTab
        userProfile={userProfile}
        setUserProfile={vi.fn()}
        searchPreferences={searchPreferences}
        setSearchPreferences={vi.fn()}
        isSavingProfile={false}
        isSavingPreferences={false}
        onSaveProfile={vi.fn()}
        onSavePreferences={vi.fn()}
      />,
    );

    expect(screen.getByTestId("profile-form")).toBeInTheDocument();
    expect(screen.getByTestId("preferences-form")).toBeInTheDocument();
    expect(screen.getByTestId("generate-resume-card")).toBeInTheDocument();
    expect(screen.getByTestId("connections-form")).toBeInTheDocument();
  });
});
