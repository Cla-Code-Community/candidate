import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TimeFilter } from "../../../src/app/layouts/MainLayout/Header/components/TimeFilter";

describe("TimeFilter", () => {
  it("shows the selected range and toggles to the other supported range", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TimeFilter value="24h" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Últimas 24 horas/ }));
    expect(onChange).toHaveBeenCalledWith("7d");

    rerender(<TimeFilter value="7d" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Últimos 7 dias/ }));
    expect(onChange).toHaveBeenLastCalledWith("24h");
  });
});
