import { describe, expect, it } from "vitest";
import { OperationalSnapshotSchema } from "../../../../src/modules/observability/schemas/operationalSnapshot.schema";
import { operationalFixture } from "../../../fixtures/operationalSnapshot";

describe("existing operational contract", () => {
  it("accepts idle, nullable values, zero totals and strips unknown fields", () => {
    const parsed = OperationalSnapshotSchema.parse({ ...operationalFixture, run_id: "unavailable", processor: { ...operationalFixture.processor, token: "secret" } });
    expect(parsed.processor?.execution.status).toBe("idle");
    expect(parsed.processor?.resources.cpuPercent).toBeNull();
    expect(parsed.processor?.progress.tasksTotal).toBe(0);
    expect(JSON.stringify(parsed)).not.toContain("secret");
    expect(parsed).not.toHaveProperty("run_id");
  });
  it("accepts partial with valid processor and multicore CPU, or processor down", () => {
    const processor = structuredClone(operationalFixture.processor!);
    processor.status = "partial";
    processor.resources.cpuPercent = 230;
    expect(OperationalSnapshotSchema.parse({ ...operationalFixture, status: "partial", processor }).processor?.resources.cpuPercent).toBe(230);
    expect(OperationalSnapshotSchema.parse({ ...operationalFixture, status: "partial", processor: null, availability: { scraper: "down" } }).processor).toBeNull();
  });
  it.each(["running", "canceling", "completed", "failed"])("preserves %s", (status) => {
    const processor = operationalFixture.processor!;
    expect(OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...processor, execution: { ...processor.execution, status } } }).processor?.execution.status).toBe(status);
  });
  it.each([
    { timestamp: "invalid" },
    { processor: {} },
    { availability: { scraper: "unknown" } },
  ])("rejects malformed payload %j", (patch) => {
    expect(OperationalSnapshotSchema.safeParse({ ...operationalFixture, ...patch }).success).toBe(false);
  });
});

describe("per-execution fields", () => {
  it("accepts an older backend with absent fields", () => {
    const result = OperationalSnapshotSchema.parse(operationalFixture).processor!;
    expect(result.execution.runId).toBeNull();
    expect(result.providers).toBeNull();
    expect(result.classification).toBeNull();
    expect(result.persistence).toBeNull();
  });
  it("preserves real identity, empty provider plan and zero versus null", () => {
    const p = operationalFixture.processor!;
    const result = OperationalSnapshotSchema.parse({ ...operationalFixture, processor: { ...p, execution: { ...p.execution, runId: "real-run", status: "running" }, providers: [], classification: { received: 0, classified: 0, approved: 0, rejected: 0, invalid: 0 }, persistence: null } }).processor!;
    expect(result.execution.runId).toBe("real-run");
    expect(result.providers).toEqual([]);
    expect(result.classification?.classified).toBe(0);
    expect(result.persistence).toBeNull();
  });
  it("rejects arbitrary provider names and unbounded totals", () => {
    const p = operationalFixture.processor!;
    expect(OperationalSnapshotSchema.safeParse({ ...operationalFixture, processor: { ...p, providers: [{ id: "secret-company" }] } }).success).toBe(false);
    expect(OperationalSnapshotSchema.safeParse({ ...operationalFixture, processor: { ...p, persistence: { received: -1, inserted: 0, updated: 0, skipped: 0, failed: 0, failedBatches: 0 } } }).success).toBe(false);
  });
});
