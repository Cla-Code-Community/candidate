import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../../../../src/components/notifications/NotificationProvider";
import { ScraperTable } from "../../../../src/modules/dashboard/components/RunningScrapers/ScraperTable";

describe("ScraperTable", () => {
  it("renders empty state and active rows", async () => {
    const onToggle = vi.fn();
    const onConfigure = vi.fn();
    const { rerender } = render(
      <NotificationProvider>
        <ScraperTable
          scrapers={[]}
          onToggle={onToggle}
          onConfigure={onConfigure}
        />
      </NotificationProvider>,
    );

    expect(screen.getByText("Nenhum scraper retornado pelo backend.")).toBeInTheDocument();

    rerender(
      <NotificationProvider>
        <ScraperTable
          scrapers={[
            {
              id: "s1",
              name: "Scraper",
              status: "Online",
              lastRun: "Hoje",
              collected24h: 100,
              active: false,
            },
          ]}
          onToggle={onToggle}
          onConfigure={onConfigure}
        />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByTitle("Iniciar Scraper"));
    expect(onToggle).toHaveBeenCalledWith("s1");

    fireEvent.click(screen.getByTitle("Ver detalhes de Scraper"));
    expect(onConfigure).toHaveBeenCalledWith("s1");
  });
});
