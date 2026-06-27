/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("swiper/react", () => ({
  Swiper: ({ children }: any) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }: any) => <div data-testid="swiper-slide">{children}</div>,
}));

vi.mock("swiper/modules", () => ({
  Pagination: {},
  Autoplay: {},
}));

import TeamSection from "@/domains/marketing/presentation/components/TeamSection";

describe("TeamSection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza lista da API, filtra bots e garante presença de membros fixos", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 2,
          login: "Maria",
          avatar_url: "https://github.com/maria.png",
          html_url: "https://github.com/maria",
          contributions: 1,
          type: "User",
        },
        {
          id: 3,
          login: "bot-user",
          avatar_url: "x",
          html_url: "x",
          contributions: 10,
          type: "Bot",
        },
      ],
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Maria")).toBeInTheDocument();
    });

    expect(screen.queryByText("bot-user")).not.toBeInTheDocument();

    // membros fixos
    expect(screen.getByText("PedroLucas1337")).toBeInTheDocument();
    expect(screen.getByText("thalitat")).toBeInTheDocument();

    expect(screen.getByText("QA")).toBeInTheDocument();
    expect(screen.getByText("UX/UI Designer")).toBeInTheDocument();
  });

  it("mantém fallback local quando API retorna resposta inválida", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ invalid: true }),
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Benevanio")).toBeInTheDocument();
    });
  });

  it("mantém fallback local e emite warning quando falha na API", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Benevanio")).toBeInTheDocument();
    });

    expect(warnSpy).toHaveBeenCalled();
  });

  it("atualiza avatar de PedroLucas1337 quando vem da API com avatar incorreto", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 104951475,
          login: "PedroLucas1337",
          avatar_url: "https://wrong-avatar.com/pedro.png",
          html_url: "https://github.com/PedroLucas1337",
          contributions: 5,
          type: "User",
        },
      ],
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      const pedroImg = screen.getByAltText("PedroLucas1337");
      expect(pedroImg).toHaveAttribute(
        "src",
        "https://github.com/PedroLucas1337.png"
      );
    });
  });

  it("trata erro HTTP com status nao ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Benevanio")).toBeInTheDocument();
      expect(screen.getByText("PedroLucas1337")).toBeInTheDocument();
      expect(screen.getByText("thalitat")).toBeInTheDocument();
    });
  });

  it("exibe plural de commits corretamente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 5,
          login: "TestUser",
          avatar_url: "https://github.com/test.png",
          html_url: "https://github.com/test",
          contributions: 1,
          type: "User",
        },
      ],
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("1 commit")).toBeInTheDocument();
    });
  });

  it("exibe plural de commits quando > 1", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 5,
          login: "TestUser",
          avatar_url: "https://github.com/test.png",
          html_url: "https://github.com/test",
          contributions: 10,
          type: "User",
        },
      ],
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("10 commits")).toBeInTheDocument();
    });
  });

  it("nao atualiza contributors quando lista vazia", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);

    render(<TeamSection />);

    await waitFor(() => {
      expect(screen.getByText("Benevanio")).toBeInTheDocument();
      expect(screen.getByText("PedroLucas1337")).toBeInTheDocument();
      expect(screen.getByText("thalitat")).toBeInTheDocument();
    });
  });
});