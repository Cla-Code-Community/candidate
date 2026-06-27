/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("@unpic/react", () => ({
  Image: (props: any) => <img {...props} alt={props.alt} />,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import LeftSide from "@/domains/auth/presentation/components/AuthVisualPanel";

describe("LeftSide", () => {
  it("renderiza conteúdo principal e links sociais", () => {
    render(<LeftSide />);

    expect(screen.getByText(/conectando talentos/i)).toBeInTheDocument();
    expect(screen.getByText(/desenvolvimento profissional/i)).toBeInTheDocument();
    expect(screen.getByAltText(/profissionais de tecnologia/i)).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute("href", "https://instagram.com/");
  });
});
