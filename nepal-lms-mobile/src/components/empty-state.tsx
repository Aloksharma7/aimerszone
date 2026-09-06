import { Feather } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "@/components/button";

/**
 * Forces every empty list to answer three things: what's empty, why, and
 * what to do about it — a bare "No data." reads as broken, not empty.
 */
export function EmptyState({
  icon = "inbox",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-3 rounded-2xl border border-slate-100 bg-white px-6 py-10 shadow-sm">
      <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Feather name={icon} size={20} color="#94a3b8" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-center text-sm font-semibold text-slate-900">{title}</Text>
        {description ? <Text className="text-center text-xs leading-5 text-slate-500">{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <View className="mt-1">
          <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}
