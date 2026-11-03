import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TechnologyTags } from "@/features/jobs/components/TechnologyTags";

let available = 100;
let resize = () => {};

beforeEach(() => {
  available = 100;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        if (target.hasAttribute("data-technology-line"))
          resize = () => this.callback([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const width = this.hasAttribute("data-technology-line")
        ? available
        : this.hasAttribute("data-tag-width")
          ? 40
          : this.hasAttribute("data-overflow-width")
            ? 20
            : 0;
      return {
        width,
        height: 16,
        top: 0,
        left: 0,
        bottom: 16,
        right: width,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TechnologyTags", () => {
  it("mede o espaço, abre apenas as tags restantes, fecha e recalcula no resize", async () => {
    render(<TechnologyTags technologies={["React", "TypeScript", "Go"]} />);
    const trigger = screen.getByRole("button", {
      name: "Mostrar 2 tecnologias e palavras-chave restantes",
    });
    expect(trigger).toHaveTextContent("+2");
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.queryByText("Go")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "Tecnologias e palavras-chave restantes",
    });
    expect(within(dialog).getByText("TypeScript")).toBeInTheDocument();
    expect(within(dialog).getByText("Go")).toBeInTheDocument();
    expect(within(dialog).queryByText("React")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Fechar tecnologias restantes" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    available = 200;
    act(() => resize());
    expect(
      screen.queryByRole("button", { name: /restantes/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
  });

  it("não apresenta +N quando todas as tags cabem", () => {
    available = 200;
    render(<TechnologyTags technologies={["React", "TypeScript", "Go"]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
  });
});
