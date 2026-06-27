import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/domains/auth/presentation/components/AuthVisualPanel", () => ({
  default: () => <div>Left Side Mock</div>,
}));

vi.mock("@/domains/auth/presentation/components/RegisterFormPanel", () => ({
  default: () => <div>Register Side Mock</div>,
}));

import RegisterPage from "@/domains/auth/presentation/pages/RegisterPage";

describe("RegisterPage", () => {
  it("renderiza os dois lados da tela de cadastro", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Left Side Mock")).toBeInTheDocument();
    expect(screen.getByText("Register Side Mock")).toBeInTheDocument();
  });
});
