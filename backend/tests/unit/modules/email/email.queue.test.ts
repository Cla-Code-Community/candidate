import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
}));

const bullmqMocks = vi.hoisted(() => ({
  add: vi.fn(),
  close: vi.fn(),
  QueueConstructor: vi.fn(),
}));

const ioredisMocks = vi.hoisted(() => ({
  RedisConstructor: vi.fn(),
  quit: vi.fn(),
}));

vi.mock("../../../../src/config", () => ({
  getConfig: configMocks.getConfig,
}));

vi.mock("../../../../src/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    add = bullmqMocks.add;
    close = bullmqMocks.close;
    constructor(name: string, opts: unknown) {
      bullmqMocks.QueueConstructor(name, opts);
    }
  },
}));

vi.mock("ioredis", () => ({
  default: class {
    quit = ioredisMocks.quit;
    constructor(url: string, opts: unknown) {
      ioredisMocks.RedisConstructor(url, opts);
    }
  },
}));

import {
  closeEmailQueue,
  enqueueEmail,
  getEmailQueue,
} from "../../../../src/modules/email/email.queue";

describe("EmailQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configMocks.getConfig.mockReturnValue({
      valkeyUrl: "redis://localhost:6379",
      emailQueueAttempts: 3,
    });
  });

  afterEach(async () => {
    await closeEmailQueue();
  });

  it("cria a conexão ioredis com maxRetriesPerRequest null (EMAIL-01)", () => {
    getEmailQueue();

    expect(ioredisMocks.RedisConstructor).toHaveBeenCalledWith(
      "redis://localhost:6379",
      { maxRetriesPerRequest: null },
    );
  });

  it("cria a fila 'email' reutilizando a mesma instância (singleton)", () => {
    const first = getEmailQueue();
    const second = getEmailQueue();

    expect(first).toBe(second);
    expect(bullmqMocks.QueueConstructor).toHaveBeenCalledTimes(1);
    expect(bullmqMocks.QueueConstructor).toHaveBeenCalledWith(
      "email",
      expect.objectContaining({ connection: expect.anything() }),
    );
  });

  it("enfileira job com attempts do config e backoff exponencial (EMAIL-03)", async () => {
    const data = { template: "welcome", to: "user@example.com", data: {} };

    await enqueueEmail(data);

    expect(bullmqMocks.add).toHaveBeenCalledWith(
      "send-email",
      data,
      expect.objectContaining({
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      }),
    );
  });

  it("usa o valor de emailQueueAttempts do config para attempts", async () => {
    configMocks.getConfig.mockReturnValue({
      valkeyUrl: "redis://localhost:6379",
      emailQueueAttempts: 5,
    });

    await enqueueEmail({ template: "welcome", to: "a@b.com", data: {} });

    expect(bullmqMocks.add).toHaveBeenCalledWith(
      "send-email",
      expect.anything(),
      expect.objectContaining({ attempts: 5 }),
    );
  });

  it("fecha a fila e a conexão no closeEmailQueue", async () => {
    getEmailQueue();

    await closeEmailQueue();

    expect(bullmqMocks.close).toHaveBeenCalled();
    expect(ioredisMocks.quit).toHaveBeenCalled();
  });
});
