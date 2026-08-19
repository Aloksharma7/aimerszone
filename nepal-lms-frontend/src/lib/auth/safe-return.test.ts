import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/auth/safe-return";

describe("safeInternalPath", () => {
  it("keeps an internal route including query and hash", () => {
    expect(safeInternalPath("/student/explore?category=bbs#top")).toBe("/student/explore?category=bbs#top");
  });

  it("rejects protocol-relative, slash-backslash and external values", () => {
    expect(safeInternalPath("//evil.example/path", "/login")).toBe("/login");
    expect(safeInternalPath("/\\evil.example", "/login")).toBe("/login");
    expect(safeInternalPath("https://evil.example", "/login")).toBe("/login");
  });
});
