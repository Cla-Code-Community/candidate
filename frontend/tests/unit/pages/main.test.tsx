import { beforeEach, describe, expect, it, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("@/app/App", () => ({
  default: () => null,
}));

describe("main entry", () => {
  beforeEach(() => {
    vi.resetModules();
    createRootMock.mockClear();
    renderMock.mockClear();
    document.body.innerHTML = "";
  });

  it("inicializa a aplicacao quando root existe", async () => {
    document.body.innerHTML = '<div id="root"></div>';

    await import("../../../src/main.tsx");

    const rootElement = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it("lanca erro quando elemento root nao existe", async () => {
    await expect(import("../../../src/main.tsx")).rejects.toThrow("Elemento root nao encontrado.");
  });
});
