import type { Metadata } from "next";
import { ProtectedPortalLayout } from "@/components/protected-portal-layout";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedPortalLayout role="teacher">{children}</ProtectedPortalLayout>;
}
