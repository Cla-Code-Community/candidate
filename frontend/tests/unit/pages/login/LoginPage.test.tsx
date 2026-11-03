import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/components/AuthVisualPanel", () => ({
  default: () => <div>Left Side Mock</div>,
}));

vi.mock("@/features/auth/components/LoginFormPanel", () => ({
  default: () => <div>Right Side Mock</div>,
}));

import LoginPage from "@/features/auth/pages/LoginPage";

describe("LoginPage", () => {
  it("renderiza os dois lados da tela de login", () => {
    render(<LoginPage />);
    expect(screen.getByText("Left Side Mock")).toBeInTheDocument();
    expect(screen.getByText("Right Side Mock")).toBeInTheDocument();
  });
});
