import { describe, expect, it } from "vitest";
import { can, hasRole, preferredPortalHome, preferredProfilePath } from "@/lib/auth/roles";
import type { SessionUser } from "@/types/lms";

const user: SessionUser = {
  id: "u1",
  name: "Test User",
  email: null,
  mobile: null,
  studentCode: null,
  avatarUrl: null,
  status: "active",
  roles: ["staff"],
  permissions: ["courses.view", "courses.create"],
  requiredAction: null,
  portalHome: "/staff/dashboard",
};

describe("role helpers", () => {
  it("maps both the staff and accounting portals to the staff role", () => {
    expect(hasRole(user, "staff")).toBe(true);
    expect(hasRole(user, "accounting")).toBe(true);
    expect(hasRole(user, "admin")).toBe(false);
  });

  it("checks explicit permissions and preserves a safe portal home", () => {
    expect(can(user, "courses.create")).toBe(true);
    expect(can(user, "payments.review")).toBe(false);
    expect(preferredPortalHome(user)).toBe("/staff/dashboard");
  });

  it("gives super_admin an unconditional permission bypass, but not plain admin", () => {
    const admin: SessionUser = { ...user, roles: ["admin"], permissions: [] };
    const superAdmin: SessionUser = { ...user, roles: ["super_admin"], permissions: [] };

    expect(can(admin, "settings.manage")).toBe(false);
    expect(can(superAdmin, "settings.manage")).toBe(true);
  });

  it("sends the profile link to the role's own profile page, ignoring portalHome", () => {
    // portalHome can be any last-visited page — a profile link must not
    // follow it the way preferredPortalHome deliberately does.
    const wanderer: SessionUser = { ...user, roles: ["staff"], portalHome: "/staff/payments" };

    expect(preferredProfilePath(wanderer)).toBe("/staff/profile");
    expect(preferredProfilePath({ ...user, roles: ["teacher"] })).toBe("/teacher/profile");
    expect(preferredProfilePath({ ...user, roles: ["admin"] })).toBe("/admin/profile");
  });
});
