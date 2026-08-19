import type { MachineRole, SessionUser } from "@/types/lms";

const roleProfiles: Record<MachineRole, Omit<SessionUser, "roles" | "permissions" | "portalHome"> & { permissions: string[]; portalHome: string }> = {
  student: {
    id: "USR-STU-1001",
    name: "Riya Thapa",
    email: "riya@example.test",
    mobile: "+977 9800001001",
    studentCode: "STD-2083-1001",
    avatarUrl: null,
    status: "active",
    requiredAction: null,
    permissions: [
      // Mirrors the student role in the API's config/lms.php. "payments.view-own"
      // was not a real permission, so the preview hid the Payments nav item
      // that a real student sees.
      "courses.view",
      "batches.view",
      "recordings.view",
      "resources.view",
      "tests.view",
      "announcements.view",
      "payments.view",
      "receipts.view",
      "support.view",
    ],
    portalHome: "/student/dashboard",
  },
  teacher: {
    id: "USR-TCH-2001",
    name: "Aarav Sharma",
    email: "teacher.one@example.test",
    mobile: "+977 9800002001",
    studentCode: null,
    avatarUrl: null,
    status: "active",
    requiredAction: null,
    permissions: [
      "batches.view",
      "sessions.view",
      "sessions.start",
      "attendance.view",
      "attendance.finalize",
      "recordings.manage",
      "resources.manage",
      "tests.manage",
      "announcements.manage",
    ],
    portalHome: "/teacher/dashboard",
  },
  // Staff merges the former enrollment-officer and accountant profiles: one
  // office, one login, both capabilities.
  staff: {
    id: "USR-STF-3001",
    name: "Sanjay Bista",
    email: "staff@example.test",
    mobile: "+977 9800003001",
    studentCode: null,
    avatarUrl: null,
    status: "active",
    requiredAction: null,
    permissions: [
      "students.view",
      "students.manage",
      "students.reset-password",
      "payments.view",
      "payments.submit",
      "payments.review",
      "payments.refund",
      "payments.adjust",
      "enrollments.view",
      "courses.view",
      "courses.create",
      "courses.update",
      "courses.publish",
      "reports.view",
      "reports.export",
    ],
    portalHome: "/staff/dashboard",
  },
  // Everyday operations, but not settings/integrations/role management or
  // other admin accounts — that stays exclusive to Super Admin, mirrored
  // from config/lms.php's "admin" permission list.
  admin: {
    id: "USR-ADM-5001",
    name: "Admin",
    email: "admin@example.test",
    mobile: "+977 9800005001",
    studentCode: null,
    avatarUrl: null,
    status: "active",
    requiredAction: null,
    permissions: [
      "courses.view", "courses.create", "courses.update", "courses.publish", "courses.delete",
      "categories.manage",
      "batches.view", "batches.manage", "batches.delete",
      "students.view", "students.manage",
      "enrollments.view", "enrollments.manage",
      "payments.view", "payments.submit", "payments.review", "payments.adjust", "payments.refund",
      "receipts.view",
      "sessions.view", "sessions.manage", "sessions.start",
      "attendance.view", "attendance.finalize",
      "recordings.view", "recordings.manage",
      "resources.view", "resources.manage",
      "tests.view", "tests.manage",
      "announcements.view", "announcements.manage",
      "support.view", "support.manage",
      "reports.view", "reports.export",
      "users.view", "users.manage", "users.delete", "users.security",
      "syllabus.manage", "audit.view",
    ],
    portalHome: "/admin/dashboard",
  },
  super_admin: {
    id: "USR-SAD-6001",
    name: "Super Administrator",
    email: "superadmin@example.test",
    mobile: "+977 9800006001",
    studentCode: null,
    avatarUrl: null,
    status: "active",
    requiredAction: null,
    permissions: ["*"],
    portalHome: "/admin/dashboard",
  },
};

export function createMockSession(role: MachineRole): SessionUser {
  const profile = roleProfiles[role];
  return {
    ...profile,
    roles: [role],
    permissions: profile.permissions,
    portalHome: profile.portalHome,
  };
}
