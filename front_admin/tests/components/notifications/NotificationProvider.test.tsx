import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../../../src/components/notifications/NotificationProvider";
import { useNotifications } from "../../../src/components/notifications/useNotifications";

function TriggerNotification() {
  const { notify } = useNotifications();

  return (
    <button
      type="button"
      onClick={() =>
        notify({
          tone: "success",
          title: "Tudo certo",
          description: "Mensagem enviada",
        })
      }
    >
      Notificar
    </button>
  );
}

describe("NotificationProvider", () => {
  it("shows and dismisses notifications", () => {
    vi.useFakeTimers();
    render(
      <NotificationProvider>
        <TriggerNotification />
      </NotificationProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    expect(screen.getByText("Tudo certo")).toBeInTheDocument();
    expect(screen.getByText("Mensagem enviada")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar notificação" }));
    expect(screen.queryByText("Tudo certo")).not.toBeInTheDocument();
  });

  it("throws when notification hook is used outside provider", () => {
    function BrokenConsumer() {
      useNotifications();
      return null;
    }

    expect(() => render(<BrokenConsumer />)).toThrow(
      "useNotifications deve ser usado dentro de NotificationProvider",
    );
  });
});
