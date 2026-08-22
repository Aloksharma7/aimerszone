import { Redirect, Stack } from "expo-router";
import { useSessionStore } from "@/lib/auth/session-store";
import { preferredPortalHome } from "@/lib/auth/roles";

/** Guest-only: an already-authenticated user has no reason to see a login form. */
export default function AuthLayout() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status === "authenticated" && user) return <Redirect href={preferredPortalHome(user)} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
