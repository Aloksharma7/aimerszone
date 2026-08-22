import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSessionStore } from "@/lib/auth/session-store";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Proves the real round trip works — hydrate → auth guard → role routing →
 * sign out → back to login — before any portal's real screens are built.
 */
export function PortalDashboardPlaceholder({ roleLabel }: { roleLabel: string }) {
  const user = useSessionStore((state) => state.user);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-1 px-6 py-8">
        <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">{roleLabel} portal</Text>
        <Text className="mt-2 text-2xl font-bold text-slate-950">{user ? `Hi, ${user.name}` : "Signed in"}</Text>
        <Text className="mt-1 text-sm text-slate-500">Dashboard content is planned for this portal&apos;s phase — see docs/ROADMAP.md.</Text>
        <View className="mt-8">
          <SignOutButton />
        </View>
      </View>
    </SafeAreaView>
  );
}
