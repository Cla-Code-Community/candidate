import { ConnectionsForm } from "@/domains/new_dashboard/components/profile/ConnectionsForm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConnections: vi.fn(),
  connectProvider: vi.fn(),
  disconnectProvider: vi.fn(),
}));

vi.mock("@/domains/auth/infrastructure/connectionsApi", () => ({
  getConnections: mocks.getConnections,
  connectProvider: mocks.connectProvider,
  disconnectProvider: mocks.disconnectProvider,
}));

const dataWithPassword = {
  hasPassword: true,
  connections: [
    { provider: "google", connected: true, connectedAt: "2024-01-01" },
    { provider: "linkedin", connected: false, connectedAt: null },
    { provider: "github", connected: false, connectedAt: null },
  ],
};

const dataOnlyOneMethod = {
  hasPassword: false,
  connections: [
    { provider: "google", connected: true, connectedAt: "2024-01-01" },
    { provider: "linkedin", connected: false, connectedAt: null },
    { provider: "github", connected: false, connectedAt: null },
  ],
};

function renderForm(initialEntries: string[] = ["/perfil"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ConnectionsForm />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConnections.mockResolvedValue(dataWithPassword);
  mocks.connectProvider.mockResolvedValue(undefined);
  mocks.disconnectProvider.mockResolvedValue(undefined);
});

describe("ConnectionsForm", () => {
  it("mostra carregando e depois lista as conexões", async () => {
    renderForm();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Google")).toBeInTheDocument();
      expect(screen.getByText("LinkedIn")).toBeInTheDocument();
      expect(screen.getByText("GitHub")).toBeInTheDocument();
    });
    expect(screen.getByText("Conectado")).toBeInTheDocument();
    expect(screen.getAllByText("Não conectado")).toHaveLength(2);
  });

  it("exibe feedback de sucesso a partir de ?linked=", async () => {
    renderForm(["/perfil?linked=google"]);

    expect(
      screen.getByText(/conta google conectada com sucesso/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Google")).toBeInTheDocument(),
    );
  });

  it("exibe mensagem mapeada a partir de ?error= conhecido", async () => {
    renderForm(["/perfil?error=provider_already_linked"]);

    expect(
      screen.getByText(/já está vinculada a outro usuário/i),
    ).toBeInTheDocument();
  });

  it("exibe mensagem genérica a partir de ?error= desconhecido", async () => {
    renderForm(["/perfil?error=algo_inesperado"]);

    expect(screen.getByText("Erro ao conectar.")).toBeInTheDocument();
  });

  it("mostra erro quando o carregamento de conexões falha", async () => {
    mocks.getConnections.mockRejectedValueOnce(new Error("network"));
    renderForm();

    await waitFor(() =>
      expect(screen.getByText("Falha ao carregar conexões.")).toBeInTheDocument(),
    );
  });

  it("desconecta um provider conectado e mostra feedback", async () => {
    renderForm();
    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    await waitFor(() =>
      expect(mocks.disconnectProvider).toHaveBeenCalledWith("google"),
    );
    await waitFor(() =>
      expect(
        screen.getByText("Conta Google desconectada."),
      ).toBeInTheDocument(),
    );
    // refresh: carrega novamente após desconectar
    expect(mocks.getConnections).toHaveBeenCalledTimes(2);
  });

  it("mostra a mensagem de erro ao falhar a desconexão (Error)", async () => {
    mocks.disconnectProvider.mockRejectedValueOnce(new Error("boom"));
    renderForm();
    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("usa fallback quando a desconexão falha sem Error", async () => {
    mocks.disconnectProvider.mockRejectedValueOnce("x");
    renderForm();
    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));

    await waitFor(() =>
      expect(screen.getByText("Falha ao desconectar.")).toBeInTheDocument(),
    );
  });

  it("inicia a conexão de um provider não conectado", async () => {
    renderForm();
    await waitFor(() =>
      expect(screen.getByText("LinkedIn")).toBeInTheDocument(),
    );

    // Ordem: google (Desconectar), linkedin, github (Conectar)
    fireEvent.click(screen.getAllByRole("button", { name: "Conectar" })[0]);

    await waitFor(() =>
      expect(mocks.connectProvider).toHaveBeenCalledWith("linkedin"),
    );
  });

  it("mostra a mensagem de erro ao falhar o início da conexão", async () => {
    mocks.connectProvider.mockRejectedValueOnce(new Error("fail-connect"));
    renderForm();
    await waitFor(() =>
      expect(screen.getByText("LinkedIn")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Conectar" })[0]);

    await waitFor(() =>
      expect(screen.getByText("fail-connect")).toBeInTheDocument(),
    );
  });

  it("desabilita desconectar quando é o único método de login", async () => {
    mocks.getConnections.mockResolvedValue(dataOnlyOneMethod);
    renderForm();
    await waitFor(() => expect(screen.getByText("Google")).toBeInTheDocument());

    const disconnect = screen.getByRole("button", { name: "Desconectar" });
    expect(disconnect).toBeDisabled();
    expect(disconnect).toHaveAttribute(
      "title",
      "Você precisa manter ao menos um método de login.",
    );
  });
});
