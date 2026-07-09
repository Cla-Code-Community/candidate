import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider } from "../../../src/components/Providers/ThemeProvider";
import { useTheme } from "../../../src/hooks/useTheme";

function ThemeConsumer() {
  const { theme, toggleTheme, setTheme } = useTheme();

  return (
    <>
      <span>tema {theme}</span>
      <button type="button" onClick={toggleTheme}>
        alternar
      </button>
      <button type="button" onClick={() => setTheme("dark")}>
        escuro
      </button>
    </>
  );
}

describe("ThemeProvider", () => {
  it("provides theme state and persists changes", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByText("tema light")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "alternar" }));
    expect(screen.getByText("tema dark")).toBeInTheDocument();
    expect(window.localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "escuro" }));
    expect(document.documentElement).toHaveClass("dark");
  });

  it("throws when theme hook is used outside provider", () => {
    function BrokenConsumer() {
      useTheme();
      return null;
    }

    expect(() => render(<BrokenConsumer />)).toThrow(
      "useTheme deve ser usado dentro de <ThemeProvider>",
    );
  });
});
