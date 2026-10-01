import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ObservabilityPanel } from "../../../../src/lib/api/types";
import { ObservabilityPanelCard } from "../../../../src/modules/observability/components/ObservabilityPanelCard";

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

  it("formats count, bytes, seconds, and missing values at their boundaries", () => {
    const makeStatPanel = (
      unit: ObservabilityPanel["unit"],
      value: number | null,
    ): ObservabilityPanel => ({
      id: `stat-${unit}`,
      title: `Stat ${unit}`,
      unit,
      visualization: "stat",
      series: [
        {
          label: "Value",
          points: [{ timestamp: "2026-01-01T10:00:00.000Z", value }],
        },
      ],
    });
    const { rerender } = render(
      <ObservabilityPanelCard panel={makeStatPanel("count", 1250)} />,
    );

    expect(screen.getByText("1.250")).toBeInTheDocument();
    rerender(<ObservabilityPanelCard panel={makeStatPanel("count", 12.3456)} />);
    expect(screen.getByText("12.346")).toBeInTheDocument();
    rerender(<ObservabilityPanelCard panel={makeStatPanel("bytes", 2048)} />);
    expect(screen.getByText("2.0 KiB")).toBeInTheDocument();
    rerender(
      <ObservabilityPanelCard panel={makeStatPanel("bytes", 1024 ** 5)} />,
    );
    expect(screen.getByText("1048576.0 GiB")).toBeInTheDocument();
    rerender(
      <ObservabilityPanelCard panel={makeStatPanel("seconds", 30.456)} />,
    );
    expect(screen.getByText("30.5 s")).toBeInTheDocument();
    rerender(<ObservabilityPanelCard panel={makeStatPanel("seconds", 59.99)} />);
    expect(screen.getByText("60.0 s")).toBeInTheDocument();
    rerender(<ObservabilityPanelCard panel={makeStatPanel("none", null)} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    rerender(
      <ObservabilityPanelCard panel={makeStatPanel("percent", 1.25)} />,
    );
    expect(screen.getByText("1.25%")).toBeInTheDocument();
    rerender(<ObservabilityPanelCard panel={makeStatPanel("ms", 65.6)} />);
    expect(screen.getByText("66 ms")).toBeInTheDocument();
    rerender(
      <ObservabilityPanelCard panel={makeStatPanel("seconds", 5.123)} />,
    );
    expect(screen.getByText("5.12 s")).toBeInTheDocument();
    rerender(
      <ObservabilityPanelCard panel={makeStatPanel("seconds", 3600)} />,
    );
    expect(screen.getByText("60.0 min")).toBeInTheDocument();
  });

  it("shows nearest series values on hover and clears the tooltip on leave", () => {
    const { container } = render(
      <ObservabilityPanelCard panel={panel("count", "line")} />,
    );
    const chart = container.querySelector("svg") as SVGSVGElement;
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 760,
      bottom: 236,
      width: 760,
      height: 236,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });

    fireEvent.mouseMove(chart, { clientX: 700, clientY: 100 });
    const tooltip = container.querySelector("div.absolute.top-4");
    expect(tooltip).toHaveTextContent("Serie A");
    expect(tooltip).toHaveTextContent("2.048");
    expect(tooltip).toHaveStyle({ right: "12px" });

    fireEvent.mouseLeave(chart);
    expect(screen.queryByText("2.048")).not.toBeInTheDocument();

    fireEvent.mouseMove(chart, { clientX: 80, clientY: 100 });
    const leftTooltip = container.querySelector("div.absolute.top-4");
    expect(leftTooltip?.style.left).toContain("calc(");
    expect(leftTooltip?.style.right).toBe("auto");
  });

  it("restores all visible series if a selected series disappears", () => {
    const { rerender } = render(
      <ObservabilityPanelCard panel={panel("count", "line")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Serie A" }));
    rerender(
      <ObservabilityPanelCard
        panel={{
          id: "replacement",
          title: "Replacement",
          unit: "count",
          visualization: "line",
          series: [
            {
              label: "Serie C",
              points: [{ timestamp: "2026-01-01T10:03:00.000Z", value: 7 }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Serie C" })).toBeInTheDocument();
  });

  it("does not expose non-finite metric values as chart points", () => {
    render(
      <ObservabilityPanelCard
        panel={{
          id: "invalid-values",
          title: "Invalid values",
          unit: "count",
          visualization: "line",
          series: [
            {
              label: "Invalid",
              points: [
                { timestamp: "2026-01-01T10:00:00.000Z", value: Number.NaN },
                { timestamp: "2026-01-01T10:01:00.000Z", value: Infinity },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("No data")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Invalid" })).not.toBeInTheDocument();
  });
});
