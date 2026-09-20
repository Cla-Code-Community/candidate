import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  use: vi.fn(),
  set: vi.fn(),
  createJobsApiApp: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  swaggerServe: vi.fn(),
  swaggerSetup: vi.fn(() => vi.fn()),
  startEmailWorker: vi.fn(),
  stopEmailWorker: vi.fn(async () => {}),
  closeEmailQueue: vi.fn(async () => {}),
  closeCache: vi.fn(async () => {}),
}));

mocks.createJobsApiApp.mockReturnValue({
  listen: mocks.listen,
  use: mocks.use,
  set: mocks.set,
});

vi.mock("dotenv/config", () => ({}));

// O server.ts importa de "./app" → ajustado para src/app.js
vi.mock("../../../src/app.js", () => ({
  createJobsApiApp: mocks.createJobsApiApp,
}));

vi.mock("../../../src/logger.js", () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}));

vi.mock("swagger-ui-express", () => ({
  default: {
    serve: mocks.swaggerServe,
    setup: mocks.swaggerSetup,
  },
}));

vi.mock("../../../src/swagger.js", () => ({
  default: {},
}));

vi.mock("../../../src/modules/email/email.worker.js", () => ({
  startEmailWorker: mocks.startEmailWorker,
  stopEmailWorker: mocks.stopEmailWorker,
}));

vi.mock("../../../src/modules/email/email.queue.js", () => ({
  closeEmailQueue: mocks.closeEmailQueue,
}));

vi.mock("../../../src/lib/cache.js", () => ({
  closeCache: mocks.closeCache,
}));

async function importServerEntry() {
  await import("../../../src/server.js");
  await vi.dynamicImportSettled();
  await Promise.resolve();
}

describe("server entry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.PORT = "3100";

    // Re-aplicar o mock após resetModules
    mocks.createJobsApiApp.mockReturnValue({
      listen: mocks.listen,
      use: mocks.use,
      set: mocks.set,
    });
  });

  it("inicializa app e chama listen", async () => {
    await importServerEntry();

    expect(mocks.createJobsApiApp).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith("trust proxy", 1);
    expect(mocks.startEmailWorker).toHaveBeenCalledTimes(1);
    expect(mocks.listen).toHaveBeenCalled();
    expect(mocks.listen.mock.calls[0][0]).toBe(3100);
  });

  it("usa porta padrão quando PORT não definido", async () => {
    delete process.env.PORT;

    await importServerEntry();

    expect(mocks.listen.mock.calls[0][0]).toBe(3001);
  });

  it("loga mensagens ao iniciar", async () => {
    await importServerEntry();

    const onListen = mocks.listen.mock.calls[0][1];
    onListen();

    expect(mocks.logInfo).toHaveBeenCalledWith(
      "API rodando em http://localhost:3100",
    );
    expect(mocks.logInfo).toHaveBeenCalledWith(
      "Documentação da API em http://localhost:3100/docs",
    );
  });

  it("registra swagger docs", async () => {
    await importServerEntry();

    expect(mocks.use).toHaveBeenCalledWith(
      "/docs",
      mocks.swaggerServe,
      expect.any(Function),
    );
  });

  it("loga warn quando swagger falha", async () => {
    vi.doMock("swagger-ui-express", () => {
      throw new Error("swagger indisponível");
    });

    await importServerEntry();

    expect(mocks.logWarn).toHaveBeenCalledWith(
      "Swagger desabilitado",
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});
