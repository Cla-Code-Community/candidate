import LandingPage from "@/features/marketing/pages/LandingPage";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


vi.mock("@/features/marketing/components/Navbar", () => ({
  Navbar: () => <div data-testid="navbar" />,
}));

vi.mock("@/features/marketing/components/HeroSection", () => ({
  HeroSection: () => <div data-testid="hero-section" />,
}));

vi.mock("@/features/marketing/components/FeaturesSection", () => ({
  FeaturesSection: () => <div data-testid="features-section" />,
}));

vi.mock("@/features/marketing/components/TeamSection", () => ({
  default: () => <div data-testid="team-section" />,
}));

vi.mock("@/features/marketing/components/HowItWorks", () => ({
  HowItWorks: () => <div data-testid="how-it-works" />,
}));

vi.mock("@/features/marketing/components/CTASection", () => ({
  CTASection: () => <div data-testid="cta-section" />,
}));

vi.mock("@/features/marketing/components/Footer", () => ({
  Footer: () => <div data-testid="footer" />,
}));

describe("LandingPage", () => {
  it("deve renderizar todos os componentes da landing page", () => {
    render(<LandingPage />);

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    expect(screen.getByTestId("features-section")).toBeInTheDocument();
    expect(screen.getByTestId("team-section")).toBeInTheDocument();
    expect(screen.getByTestId("how-it-works")).toBeInTheDocument();
    expect(screen.getByTestId("cta-section")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("deve renderizar um elemento main", () => {
    const { container } = render(<LandingPage />);

    expect(container.querySelector("main")).toBeInTheDocument();
  });

  it("deve renderizar o container principal com a classe landing-page", () => {
    const { container } = render(<LandingPage />);

    expect(container.firstChild).toHaveClass("landing-page");
  });
});