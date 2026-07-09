import { describe, expect, it, vi } from "vitest";
import {
  applyTheme,
  getInitialTheme,
  persistTheme,
} from "../../../src/lib/theme/theme";

describe("theme helpers", () => {
  it("applies classes and css variables for a selected theme", () => {
    document.documentElement.classList.add("existing", "dark");

    applyTheme("light");

    expect(document.documentElement).toHaveClass("existing");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.getPropertyValue("--color-background"))
      .toBe("#f8fafc");
    expect(document.documentElement.style.getPropertyValue("--color-text-primary"))
      .toBe("#0f172a");
  });

  it("reads persisted theme before system preference", () => {
    window.localStorage.setItem("theme", "dark");

    expect(getInitialTheme()).toBe("dark");
  });

  it("falls back to the dark system preference", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    expect(getInitialTheme()).toBe("dark");
  });

  it("persists the chosen theme", () => {
    persistTheme("light");

    expect(window.localStorage.getItem("theme")).toBe("light");
  });
});
