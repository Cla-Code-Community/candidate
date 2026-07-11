import { describe, expect, it } from "vitest";
import {
  InfraUsageSchema,
  ObservabilityMetricSchema,
} from "../../../../src/modules/observability/schemas/observability.schemas";

describe("observability schemas", () => {
  it("validates metric and infra usage values", () => {
    expect(
      ObservabilityMetricSchema.parse({
        label: "Latência p95",
        value: "120ms",
        note: "normal",
        tone: "success",
      }).tone,
    ).toBe("success");

    expect(
      InfraUsageSchema.parse({
        label: "CPU",
        valueLabel: "42%",
        percentage: 42,
        color: "bg-blue-500",
      }).percentage,
    ).toBe(42);
  });

  it("rejects out-of-range infrastructure percentage", () => {
    expect(() =>
      InfraUsageSchema.parse({
        label: "RAM",
        valueLabel: "110%",
        percentage: 110,
        color: "bg-rose-500",
      }),
    ).toThrow();
  });
});
