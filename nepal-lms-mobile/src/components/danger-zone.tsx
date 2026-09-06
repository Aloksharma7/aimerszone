import { Feather } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

/**
 * The one visual treatment for a destructive/irreversible action block —
 * deliberately heavier than the standard card so it reads as different in
 * kind from "recent activity" sitting right next to it, not just another
 * rounded rectangle in the same stack.
 */
export function DangerZone({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border-[1.5px] border-danger-200 bg-danger-100/40 p-4">
      <View className="flex-row items-center gap-2">
        <Feather name="alert-triangle" size={16} color="#b91c1c" />
        <Text className="text-base font-bold text-danger-700">{title}</Text>
      </View>
      <Text className="text-sm text-danger-700">{description}</Text>
      {children}
    </View>
  );
}
