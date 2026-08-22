import { useRouter } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSessionStore } from "@/lib/auth/session-store";

export function SignOutButton() {
  const router = useRouter();
  const signOut = useSessionStore((state) => state.signOut);

  async function handlePress() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <Pressable onPress={handlePress} className="h-11 items-center justify-center rounded-xl border border-slate-300 px-4 active:bg-slate-100">
      <Text className="text-sm font-semibold text-slate-700">Sign out</Text>
    </Pressable>
  );
}
