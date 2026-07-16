import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useDashboardTheme } from "@/domains/new_dashboard/context/ThemeContext";
import { ToastProvider, useToastContext } from "@/domains/new_dashboard/context/ToastContext";

const mockUseTheme = vi.fn();

vi.mock("@/shared/hooks/useTheme", () => ({
  useTheme: () => mockUseTheme(),
}));

function ThemeConsumer() {
  const { colors } = useDashboardTheme();
  return <p>{colors === undefined ? "none" : "ok"}</p>;
}

function ToastConsumer() {
  const { toast, triggerToast, clearToast } = useToastContext();

  useEffect(() => {
    triggerToast("Mensagem temporária");
  }, []);

  return (
    <div>
      <span>{toast}</span>
      <button type="button" onClick={clearToast}>
        limpar
      </button>
    </div>
  );
}

function ToastHookConsumer() {
  useToastContext();
  return null;
}

describe("new_dashboard theme and toast contexts", () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockUseTheme.mockReset();
  });

  it("fornece cores claras e escuras no contexto de tema", () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: "dark",
      toggleTheme: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("fornece cores claras quando o tema não é dark", () => {
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      toggleTheme: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("lança erro quando o contexto de tema é usado fora do provider", () => {
    expect(() => render(<ThemeConsumer />)).toThrow(
      /useDashboardTheme must be used within ThemeProvider/i,
    );
  });

  it("mostra e limpa toast temporário", async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    expect(screen.getByText("Mensagem temporária")).toBeInTheDocument();

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.queryByText("Mensagem temporária")).not.toBeInTheDocument();
  });

  it("lança erro quando o contexto de toast é usado fora do provider", () => {
    expect(() => render(<ToastHookConsumer />)).toThrow(
      /useToastContext must be used within ToastProvider/i,
    );
  });
});
