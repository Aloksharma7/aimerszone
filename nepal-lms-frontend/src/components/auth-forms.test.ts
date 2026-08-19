import { describe, expect, it } from "vitest";
import { authDestination } from "@/components/auth-forms";
import type { AuthenticatedUser } from "@/lib/api/contracts";

function makeAuth(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    user: { id: "u1", name: "Test User", status: "active" },
    roles: ["admin"],
    permissions: [],
    required_action: null,
    portal_home: "/admin/dashboard",
    ...overrides,
  };
}

describe("authDestination", () => {
  it("sends an admin to their own dashboard, not a stale returnTo from a different account's session", () => {
    const auth = makeAuth({ roles: ["admin"], portal_home: "/admin/dashboard" });
    expect(authDestination(auth, "/student/explore")).toBe("/admin/dashboard");
  });

  it("sends a super admin to their own dashboard for the same stale returnTo", () => {
    const auth = makeAuth({ roles: ["super_admin"], portal_home: "/admin/dashboard" });
    expect(authDestination(auth, "/student/explore")).toBe("/admin/dashboard");
  });

  it("honours a returnTo the account's own role actually owns", () => {
    const auth = makeAuth({ roles: ["admin"], portal_home: "/admin/dashboard" });
    expect(authDestination(auth, "/admin/batches")).toBe("/admin/batches");
  });

  it("honours a returnTo for a role the account genuinely holds among several", () => {
    const auth = makeAuth({ roles: ["admin", "teacher"], portal_home: "/admin/dashboard" });
    expect(authDestination(auth, "/teacher/dashboard")).toBe("/teacher/dashboard");
  });

  it("falls back to portal_home when there is no returnTo", () => {
    const auth = makeAuth({ roles: ["student"], portal_home: "/student/dashboard" });
    expect(authDestination(auth, null)).toBe("/student/dashboard");
  });

  it("sends a required_action to its own screen ahead of any returnTo", () => {
    const auth = makeAuth({ required_action: "change_password" });
    expect(authDestination(auth, "/admin/batches")).toBe("/change-password");
  });
});
