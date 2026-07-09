import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuditPage } from "../../../src/modules/audit/AuditPage";
import { auditApi } from "../../../src/lib/api/audit.api";
import { renderWithProviders } from "../../test-utils";

vi.mock("../../../src/lib/api/audit.api", () => ({
  auditApi: {
    list: vi.fn(),
  },
}));

const logs = [
  {
    id: 1,
    actorId: "actor-1",
    actorRole: "super_admin" as const,
    action: "users.delete",
    targetType: "users",
    targetId: "user-1",
    metadata: { reason: "test" },
    ip: "127.0.0.1",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  {
    id: 2,
    actorId: null,
    actorRole: "support" as const,
    action: "dashboard.read",
    targetType: "dashboard",
    targetId: null,
    metadata: null,
    ip: null,
    createdAt: "2026-01-01T11:00:00.000Z",
  },
];

describe("AuditPage", () => {
  beforeEach(() => {
    vi.mocked(auditApi.list).mockResolvedValue({
      data: logs,
      total: 40,
      limit: 20,
      offset: 0,
    });
  });

  it("loads audit logs, filters and opens details", async () => {
    renderWithProviders(<AuditPage />);

    expect(screen.getByText("Carregando eventos...")).toBeInTheDocument();
    await screen.findByText("Trilhas de Auditoria");
    expect(await screen.findAllByText("users.delete")).toHaveLength(2);

    expect(screen.getByText("40")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Todas as ações"), {
      target: { value: "users.delete" },
    });
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: "users.delete", offset: 0 }),
      ),
    );

    fireEvent.change(screen.getByPlaceholderText("Filtrar por actorId UUID"), {
      target: { value: "actor-1" },
    });
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ actorId: "actor-1" }),
      ),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Abrir" })[0]);
    expect(screen.getByText("Evento #1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByText("Evento #1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 20 }),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await waitFor(() =>
      expect(auditApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: undefined, actorId: undefined }),
      ),
    );
  });

  it("shows a backend error", async () => {
    vi.mocked(auditApi.list).mockRejectedValueOnce(new Error("fail"));

    renderWithProviders(<AuditPage />);

    expect(
      await screen.findByText(/Nao foi possivel carregar auditoria/),
    ).toBeInTheDocument();
  });
});
