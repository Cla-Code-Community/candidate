import { cn } from "@/shared/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("mescla classes e resolve conflitos tailwind", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });
});
