import { KeywordsModal } from "@/domains/jobs/presentation/components/KeywordsModal";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchKeywordsMock: vi.fn(async () => ["react", "node"]),
  saveKeywordsMock: vi.fn(async () => {}),
}));

vi.mock("@/domains/jobs/infrastructure/jobsApi", () => ({
  fetchKeywords: mocks.fetchKeywordsMock,
  saveKeywords: mocks.saveKeywordsMock,
}));

describe("KeywordsModal", () => {
  it("carrega e exibe keywords ao montar", async () => {
    render(<KeywordsModal onClose={vi.fn()} />);

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("react")).toBeInTheDocument();
      expect(screen.getByText("node")).toBeInTheDocument();
    });
  });

  it("adiciona uma nova keyword localmente", async () => {
    render(<KeywordsModal onClose={vi.fn()} />);

    await waitFor(() =>
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument(),
    );

    const input = screen.getByPlaceholderText(/nova keyword/i);
    const addButton = screen.getByRole("button", { name: /adicionar/i });

    fireEvent.change(input, { target: { value: "typescript" } });
    fireEvent.click(addButton);

    expect(screen.getByText("typescript")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("limita novas keywords e preserva o texto completo no title", async () => {
    mocks.fetchKeywordsMock.mockResolvedValueOnce(["a".repeat(100)]);
    render(<KeywordsModal onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/nova keyword/i);
    expect(input).toHaveAttribute("maxlength", "100");

    const keyword = await screen.findByText("a".repeat(100));
    expect(keyword).toHaveClass("truncate");
    expect(keyword.closest("[title]")).toHaveAttribute(
      "title",
      "a".repeat(100),
    );
  });

  it("remove uma keyword localmente", async () => {
    render(<KeywordsModal onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("react")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: /remover keyword react/i }),
    );

    expect(screen.queryByText("react")).not.toBeInTheDocument();
  });

  it("salva as alterações e fecha o modal", async () => {
    const onClose = vi.fn();
    render(<KeywordsModal onClose={onClose} />);

    await waitFor(() => expect(screen.getByText("react")).toBeInTheDocument());

    const saveButton = screen.getByRole("button", {
      name: /salvar alterações/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.saveKeywordsMock).toHaveBeenCalledWith(["react", "node"]);
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("fecha o modal ao clicar em cancelar", async () => {
    const onClose = vi.fn();
    render(<KeywordsModal onClose={onClose} />);

    await waitFor(() =>
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument(),
    );

    const cancelButton = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalled();
  });
});
