import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarFooter } from "../../../src/app/layouts/MainLayout/Sidebar/components/SidebarFooter";

describe("SidebarFooter", () => {
  it("disables logout while pending and restores the button when complete", async () => {
    let finishLogout!: () => void;
    const onLogout = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
    );
    render(<SidebarFooter onLogout={onLogout} />);

    const logoutButton = screen.getByRole("button", { name: "Sair" });
    fireEvent.click(logoutButton);

    expect(onLogout).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Saindo..." })).toBeDisabled();

    finishLogout();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
    });
  });
});
