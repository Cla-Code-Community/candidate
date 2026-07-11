import { fireEvent, render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ErrorMessage } from "../../../src/components/common/ErrorMessage";
import { Loader } from "../../../src/components/common/Loader";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { ProgressCircle } from "../../../src/components/ui/ProgressCircle";
import { StatusBadge } from "../../../src/components/ui/StatusBadge";
import { UsageBar } from "../../../src/components/ui/UsageBar";

describe("shared ui components", () => {
  it("renders loader and error message states", () => {
    const { rerender } = render(<ErrorMessage message="" />);
    expect(screen.queryByText("Falhou")).not.toBeInTheDocument();

    rerender(<ErrorMessage message="Falhou" />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();

    render(<Loader text="Carregando dados" size="lg" />);
    expect(screen.getByText("Carregando dados")).toBeInTheDocument();
  });

  it("renders empty state with optional action", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="sem dados"
        description="Nada retornou"
        actionLabel="Recarregar"
        onAction={onAction}
        icon={Settings}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Recarregar" }));

    expect(screen.getByText("sem dados")).toBeInTheDocument();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders status badge, usage bar and progress circle", () => {
    const { container } = render(
      <>
        <StatusBadge label="Online" tone="success" />
        <UsageBar
          label="CPU"
          valueLabel="42%"
          percentage={42}
          color="bg-blue-500"
        />
        <ProgressCircle value={75} color="#10b981" label="Scraper" />
      </>,
    );

    expect(screen.getByText("Online")).toBeInTheDocument();
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(container.querySelector('[style="width: 42%;"]')).toBeTruthy();
  });
});
