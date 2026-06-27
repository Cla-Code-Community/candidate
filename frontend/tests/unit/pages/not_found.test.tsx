/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
}));

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => <div data-testid="lottie-player" />,
}));

import NotFound from "@/app/NotFound";

describe("NotFound", () => {
  it("renderiza mensagem e link para voltar ao inicio", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>,
    );

    expect(screen.getByText(/página não encontrada/i)).toBeInTheDocument();
    expect(screen.getByText(/panda se perdeu/i)).toBeInTheDocument();
    expect(screen.getByTestId("lottie-player")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /voltar para o início/i })).toHaveAttribute("href", "/");
  });
});
