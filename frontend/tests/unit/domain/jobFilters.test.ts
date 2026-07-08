import { describe, expect, it } from "vitest";
import { normalizeComparableText, normalizeComparableLink } from "@/domains/jobs/domain/jobFilters";

describe("jobFilters domain utilities", () => {
  describe("normalizeComparableText", () => {
    it("normalizes text by removing diacritics and converting to lowercase", () => {
      expect(normalizeComparableText("São Paulo")).toBe("sao paulo");
      expect(normalizeComparableText("Árvore")).toBe("arvore");
    });

    it("handles special characters by replacing them with spaces", () => {
      expect(normalizeComparableText("Node.js")).toBe("node js");
      expect(normalizeComparableText("React/Redux")).toBe("react redux");
    });

    it("trims and normalizes multiple spaces", () => {
      expect(normalizeComparableText("  React   JS  ")).toBe("react js");
    });
  });

  describe("normalizeComparableLink", () => {
    it("removes query parameters and hashes from URLs", () => {
      expect(normalizeComparableLink("https://example.com/jobs/1?utm=source#top")).toBe("https://example.com/jobs/1");
    });

    it("returns empty string for invalid or empty inputs", () => {
      expect(normalizeComparableLink(null)).toBe("");
      expect(normalizeComparableLink("   ")).toBe("");
    });
  });
});
