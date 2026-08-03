import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registryMocks = vi.hoisted(() => ({
  renderTemplate: vi.fn(),
}));

const providerMocks = vi.hoisted(() => ({
  send: vi.fn(),
  getMailProvider: vi.fn(),
}));

const queueMocks = vi.hoisted(() => ({
  getEmailConnection: vi.fn(() => ({})),
}));

const loggerMocks = vi.hoisted(() => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

// Captura o processor e os handlers registrados no Worker.
const workerState = vi.hoisted(() => ({
  processor: null as
    | ((job: { data: unknown }) => Promise<unknown>)
    | null,
  handlers: {} as Record<string, (...args: unknown[]) => void>,
  close: vi.fn(),
  on: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Worker: class {
    close = workerState.close;
    constructor(
      _name: string,
      processor: (job: { data: unknown }) => Promise<unknown>,
    ) {
      workerState.processor = processor;
    }
    on(event: string, handler: (...args: unknown[]) => void) {
      workerState.handlers[event] = handler;
      workerState.on(event, handler);
      return this;
    }
  },
}));

vi.mock("../../../../src/modules/email/email.queue", () => ({
  EMAIL_QUEUE_NAME: "email",
  getEmailConnection: queueMocks.getEmailConnection,
}));

vi.mock("../../../../src/modules/email/templates/registry", () => ({
  renderTemplate: registryMocks.renderTemplate,
}));

vi.mock("../../../../src/modules/email/providers/mail-provider", () => ({
  getMailProvider: providerMocks.getMailProvider,
}));

vi.mock("../../../../src/logger", () => loggerMocks);

import {
  startEmailWorker,
  stopEmailWorker,
} from "../../../../src/modules/email/email.worker";

describe("EmailWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerState.processor = null;
    workerState.handlers = {};
    providerMocks.getMailProvider.mockReturnValue({ send: providerMocks.send });
    registryMocks.renderTemplate.mockResolvedValue({
      subject: "Bem-vindo",
      html: "<p>Olá</p>",
    });
    providerMocks.send.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await stopEmailWorker();
  });

  it("renderiza o template e despacha via provider com to/subject/html (EMAIL-02)", async () => {
    startEmailWorker();
    const job = {
      data: { template: "welcome", to: "user@example.com", data: { name: "Ana" } },
    };

    await workerState.processor!(job);

    expect(registryMocks.renderTemplate).toHaveBeenCalledWith("welcome", {
      name: "Ana",
    });
    expect(providerMocks.send).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Bem-vindo",
      html: "<p>Olá</p>",
    });
  });

  it("propaga o erro do provider para permitir retry do BullMQ (EMAIL-03)", async () => {
    providerMocks.send.mockRejectedValue(new Error("provider down"));
    startEmailWorker();
    const job = {
      data: { template: "welcome", to: "user@example.com", data: {} },
    };

    await expect(workerState.processor!(job)).rejects.toThrow("provider down");
  });

  it("registra o erro no handler 'failed' sem lançar (EMAIL-03)", () => {
    startEmailWorker();
    const failedHandler = workerState.handlers["failed"];
    expect(failedHandler).toBeDefined();

    const job = { id: "job-1", data: { to: "user@example.com" } };
    expect(() =>
      failedHandler(job, new Error("fracasso final")),
    ).not.toThrow();
    expect(loggerMocks.logError).toHaveBeenCalled();
  });
});
