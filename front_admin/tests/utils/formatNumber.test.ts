import { describe, expect, it } from "vitest";
import { formatNumber } from "../../src/utils/formatNumber";

describe("formatNumber", () => {
  it("formats integers with Brazilian thousands separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1_000)).toBe("1.000");
    expect(formatNumber(1_234_567)).toBe("1.234.567");
  });
});
