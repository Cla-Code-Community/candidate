import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ObservabilityPanelCard } from "../../../../src/modules/observability/components/ObservabilityPanelCard";
import type { ObservabilityPanel } from "../../../../src/lib/api/types";

const basePoints = [
  { timestamp: "2026-01-01T10:00:00.000Z", value: 1 },
  { timestamp: "2026-01-01T10:01:00.000Z", value: 2048 },
  { timestamp: "2026-01-01T10:02:00.000Z", value: null },
];

function panel(unit: ObservabilityPanel["unit"], visualization: "line" | "stat") {
  return {
    id: `${unit}-${visualization}`,
    title: `${unit} panel`,
    description: "desc",
    unit,
    visualization,
    series: [
      { label: "Serie A", points: basePoints },
      {
        label: "Serie B",
        points: [
          { timestamp: "2026-01-01T10:00:00.000Z", value: 65 },
          { timestamp: "invalid", value: 66 },
        ],
      },
      {
        label: "No data",
        points: [{ timestamp: "2026-01-01T10:00:00.000Z", value: null }],
      },
    ],
  } satisfies ObservabilityPanel;
}

describe("ObservabilityPanelCard", () => {
  it("formats stat panels for supported units", () => {
    const { rerender } = render(<ObservabilityPanelCard panel={panel("percent", "stat")} />);
    expect(screen.getByText("66.0%")).toBeInTheDocument();

    rerender(<ObservabilityPanelCard panel={panel("ms", "stat")} />);
    expect(screen.getByText("66 ms")).toBeInTheDocument();

    rerender(<ObservabilityPanelCard panel={panel("seconds", "stat")} />);
    expect(screen.getByText("1.10 min")).toBeInTheDocument();

    rerender(<ObservabilityPanelCard panel={panel("bytes", "stat")} />);
    expect(screen.getByText("66 B")).toBeInTheDocument();
  });

  it("renders line charts, filters series and shows no data", () => {
    const { rerender, container } = render(
      <ObservabilityPanelCard panel={panel("count", "line")} />,
    );

    expect(screen.getByText("count panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Serie A" }));
    fireEvent.click(screen.getByRole("button", { name: "Serie A" }));
    expect(container.querySelectorAll("path").length).toBeGreaterThan(0);

    rerender(
      <ObservabilityPanelCard
        panel={{
          id: "empty",
          title: "Empty",
          unit: "none",
          visualization: "line",
          series: [{ label: "empty", points: [{ timestamp: "bad", value: null }] }],
        }}
      />,
    );
    expect(screen.getAllByText("No data")).toHaveLength(2);
  });
});
