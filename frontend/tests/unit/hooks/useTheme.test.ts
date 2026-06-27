import { useTheme } from "@/shared/hooks/useTheme";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MediaQueryListener = () => void;

function mockMatchMedia(initialDark: boolean) {
  let isDark = initialDark;
  const listeners = new Set<MediaQueryListener>();

  const mediaQuery = {
    get matches() {
      return isDark;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_event: string, listener: MediaQueryListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: MediaQueryListener) => {
      listeners.delete(listener);
    }),
    onchange: null,
    dispatchEvent: vi.fn(),
  };

  vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

  return {
    mediaQuery,
    setDark(nextDark: boolean) {
      isDark = nextDark;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  it("aplica tema dark quando sistema prefere dark", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("faz fallback para system quando valor salvo e invalido", () => {
    localStorage.setItem("jobs-theme-preference", "invalido");
    mockMatchMedia(false);

    const { result } = renderHook(() => useTheme());

    expect(result.current.themePreference).toBe("system");
    expect(result.current.resolvedTheme).toBe("light");
    expect(localStorage.getItem("jobs-theme-preference")).toBe("system");
  });

  it("permite definir preferencia explicita e alternar tema", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setThemePreference("light");
    });

    expect(result.current.themePreference).toBe("light");
    expect(result.current.resolvedTheme).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.themePreference).toBe("dark");
    expect(result.current.resolvedTheme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("reage a mudanca do sistema apenas quando preferencia e system", () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useTheme());

    media.setDark(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      result.current.setThemePreference("light");
    });

    media.setDark(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(result.current.themePreference).toBe("light");
  });
});
