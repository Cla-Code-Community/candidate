import { afterEach, expect, it, vi } from "vitest";
import { OperationalSnapshotSchema } from "../../../src/modules/observability/schemas/operationalSnapshot.schema";
import { observabilityApi } from "../../../src/lib/api/observability.api";
import { operationalFixture } from "../../fixtures/operationalSnapshot";

afterEach(() => vi.unstubAllGlobals());

it("requests the administrative snapshot with cookies, no-store and cancellation", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => operationalFixture });
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  expect(await observabilityApi.getOperationalSnapshot(signal)).toEqual(OperationalSnapshotSchema.parse(operationalFixture));
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/admin\/observability$/), expect.objectContaining({ signal, cache: "no-store", credentials: "include" }));
});

it("validates payloads at the client boundary", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok" }) }));
  await expect(observabilityApi.getOperationalSnapshot()).rejects.toThrow();
});
