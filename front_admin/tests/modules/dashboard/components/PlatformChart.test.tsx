import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformChart } from "../../../../src/modules/dashboard/components/PlatformOverview/PlatformChart";

describe("PlatformChart", () => {
  it("renders empty, single and dense point states", () => {
    const { rerender, container } = render(<PlatformChart points={[]} />);
    expect(
      screen.getByText("Aguardando novos snapshots para formar a tendência"),
    ).toBeInTheDocument();

    rerender(
      <PlatformChart
        points={[
          {
            timestamp: "t1",
            label: "10:00",
            totalJobs: 5,
            activeUsers: 2,
          },
        ]}
      />,
    );
    expect(screen.getByText("10:00")).toBeInTheDocument();

    rerender(
      <PlatformChart
        points={Array.from({ length: 8 }, (_, index) => ({
          timestamp: `t${index}`,
          label: `10:0${index}`,
          totalJobs: 10 + index,
          activeUsers: index,
        }))}
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(16);
  });
});
