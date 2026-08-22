import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

export function SettingsRow({
  icon,
  label,
  detail,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  detail?: string;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const isDanger = tone === "danger";

  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${isDanger ? "bg-danger-100" : "bg-brand-100"}`}>
        <Feather name={icon} size={18} color={isDanger ? "#b91c1c" : "#1d4ed8"} />
      </View>
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${isDanger ? "text-danger-700" : "text-slate-900"}`}>{label}</Text>
        {detail ? (
          <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      {!isDanger ? <Feather name="chevron-right" size={18} color="#94a3b8" /> : null}
    </Pressable>
  );
}
