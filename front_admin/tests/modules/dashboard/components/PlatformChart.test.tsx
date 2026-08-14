import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlatformChart } from "../../../../src/modules/dashboard/components/PlatformOverview/PlatformChart";

describe("PlatformChart", () => {
  it("renders empty, single and dense point states with index metrics", () => {
    const { rerender, container } = render(<PlatformChart points={[]} />);
    expect(
      screen.getByText("Aguardando o primeiro snapshot do dashboard"),
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
    expect(screen.getByText("Total indexado")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(2);
    expect(screen.getByText("Índice estável")).toBeInTheDocument();
    expect(
      screen.getByText("Mais um snapshot é necessário para calcular variação."),
    ).toBeInTheDocument();

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
    expect(screen.getByText("Estado do índice")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(0);
  });
});
