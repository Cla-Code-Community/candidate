import LandingPage from "@/domains/marketing/presentation/pages/LandingPage";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


vi.mock("@/domains/marketing/presentation/components/Navbar", () => ({
  Navbar: () => <div data-testid="navbar" />,
}));

vi.mock("@/domains/marketing/presentation/components/HeroSection", () => ({
  HeroSection: () => <div data-testid="hero-section" />,
}));

vi.mock("@/domains/marketing/presentation/components/FeaturesSection", () => ({
  FeaturesSection: () => <div data-testid="features-section" />,
}));

vi.mock("@/domains/marketing/presentation/components/TeamSection", () => ({
  default: () => <div data-testid="team-section" />,
}));

vi.mock("@/domains/marketing/presentation/components/HowItWorks", () => ({
  HowItWorks: () => <div data-testid="how-it-works" />,
}));

vi.mock("@/domains/marketing/presentation/components/CTASection", () => ({
  CTASection: () => <div data-testid="cta-section" />,
}));

vi.mock("@/domains/marketing/presentation/components/Footer", () => ({
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