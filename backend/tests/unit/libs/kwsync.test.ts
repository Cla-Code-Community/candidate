import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("../../../src/logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}));

import { publish, publishBatch } from "../../../src/lib/kwsync";

function makeClient(lPushImpl?: () => Promise<unknown>) {
  return {
    lPush: vi.fn(lPushImpl ?? (() => Promise.resolve(1))),
  };
}

function getCall(client: ReturnType<typeof makeClient>, index = 0) {
  return client.lPush.mock.calls[index] as unknown as [
    string,
    string | string[],
  ];
}

describe("publish", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chama lPush com a chave correta", async () => {
    const client = makeClient();
    await publish(client as any, "React");

    expect(client.lPush).toHaveBeenCalledOnce();
    const [key] = getCall(client) as [string, string];
    expect(key).toBe("scraper:keywords:pending");
  });

  it("serializa o evento corretamente", async () => {
    const client = makeClient();
    await publish(client as any, "Node.js", "scraper", "user-1");

    const [, payload] = getCall(client) as [string, string];
    const event = JSON.parse(payload);

    expect(event.keyword).toBe("Node.js");
    expect(event.source).toBe("scraper");
    expect(event.userId).toBe("user-1");
    expect(event.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("usa source 'user' como padrao", async () => {
    const client = makeClient();
    await publish(client as any, "Vue");

    const [, payload] = getCall(client) as [string, string];
    expect(JSON.parse(payload).source).toBe("user");
  });

  it("loga sucesso apos enfileirar", async () => {
    const client = makeClient();
    await publish(client as any, "Go");
    expect(mocks.loggerInfo).toHaveBeenCalledOnce();
  });

  it("silencia erro e loga quando lPush falha", async () => {
    const client = makeClient(() => Promise.reject(new Error("redis down")));
    await expect(publish(client as any, "Java")).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });

  it("nao lanca excecao com cliente invalido", async () => {
    await expect(publish(null as any, "Rust")).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });
});

describe("publishBatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nao chama lPush quando keywords e array vazio", async () => {
    const client = makeClient();
    await publishBatch(client as any, []);
    expect(client.lPush).not.toHaveBeenCalled();
  });

  it("chama lPush uma unica vez com array de payloads", async () => {
    const client = makeClient();
    await publishBatch(client as any, ["Java", "Node.js", "Go"]);

    expect(client.lPush).toHaveBeenCalledOnce();
    const [key, payloads] = getCall(client) as [string, string[]];
    expect(key).toBe("scraper:keywords:pending");
    expect(payloads).toHaveLength(3);
  });

  it("serializa cada keyword corretamente", async () => {
    const client = makeClient();
    await publishBatch(client as any, ["Rust", "Kotlin"], "scraper");

    const [, payloads] = getCall(client) as [string, string[]];
    const events = payloads.map((p) => JSON.parse(p));

    expect(events[0]).toMatchObject({ keyword: "Rust", source: "scraper" });
    expect(events[1]).toMatchObject({ keyword: "Kotlin", source: "scraper" });
  });

  it("todos os eventos do batch tem o mesmo createdAt", async () => {
    const client = makeClient();
    await publishBatch(client as any, ["A", "B", "C"]);

    const [, payloads] = getCall(client) as [string, string[]];
    const timestamps = new Set(payloads.map((p) => JSON.parse(p).createdAt));
    expect(timestamps.size).toBe(1);
  });

  it("usa source 'user' como padrao", async () => {
    const client = makeClient();
    await publishBatch(client as any, ["TypeScript"]);

    const [, payloads] = getCall(client) as [string, string[]];
    expect(JSON.parse(payloads[0]).source).toBe("user");
  });

  it("loga sucesso com a contagem correta", async () => {
    const client = makeClient();
    await publishBatch(client as any, ["A", "B"]);

    expect(mocks.loggerInfo).toHaveBeenCalledOnce();
    const logArg = mocks.loggerInfo.mock.calls[0] as unknown as [
      { count: number },
    ];
    expect(logArg[0]).toMatchObject({ count: 2 });
  });

  it("silencia erro e loga quando lPush falha", async () => {
    const client = makeClient(() => Promise.reject(new Error("timeout")));
    await expect(
      publishBatch(client as any, ["Java"]),
    ).resolves.toBeUndefined();
    expect(mocks.loggerError).toHaveBeenCalledOnce();
  });
});
