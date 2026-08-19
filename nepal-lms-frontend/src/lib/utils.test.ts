import { describe, expect, it } from "vitest";
import { cn, formatNpr } from "@/lib/utils";

describe("shared utilities", () => {
  it("merges Tailwind classes without keeping a conflicting duplicate", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toContain("px-4");
    expect(cn("px-2", "px-4")).not.toContain("px-2");
  });

  it("formats Nepalese rupee values", () => {
    expect(formatNpr(3500)).toMatch(/3,500/);
  });
});
