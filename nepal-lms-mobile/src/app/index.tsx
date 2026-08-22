import { Redirect } from "expo-router";
import { useSessionStore } from "@/lib/auth/session-store";
import { preferredPortalHome } from "@/lib/auth/roles";

export default function Index() {
  const status = useSessionStore((state) => state.status);
  const user = useSessionStore((state) => state.user);

  if (status !== "authenticated" || !user) return <Redirect href="/(auth)/login" />;

  return <Redirect href={preferredPortalHome(user)} />;
}
