import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventConsole } from "../../../../src/modules/scrapers/components/EventConsole/EventConsole";

describe("EventConsole", () => {
  it("renders empty and populated logs", () => {
    const onClear = vi.fn();
    const { rerender } = render(<EventConsole logs={[]} onClear={onClear} />);

    expect(screen.getByText(/Nenhum evento registrado ainda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar Logs" }));
    expect(onClear).toHaveBeenCalledTimes(1);

    rerender(
      <EventConsole
        logs={[{ time: "10:00:00", text: "Scraper iniciado" }]}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("[10:00:00]")).toBeInTheDocument();
    expect(screen.getByText("Scraper iniciado")).toBeInTheDocument();
  });
});
