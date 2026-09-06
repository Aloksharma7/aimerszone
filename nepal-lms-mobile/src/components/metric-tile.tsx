import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

const tones = {
  brand: { bg: "bg-brand-100", icon: "#1d4ed8" },
  success: { bg: "bg-success-100", icon: "#15803d" },
  warning: { bg: "bg-warning-100", icon: "#a16207" },
  danger: { bg: "bg-danger-100", icon: "#b91c1c" },
  info: { bg: "bg-info-100", icon: "#0369a1" },
  neutral: { bg: "bg-slate-100", icon: "#475569" },
} as const;

/**
 * A glanceable stat. Optional `icon`/`tone` turn a bare number into
 * something the eye can sort at a glance (warning-colored "3 payments to
 * review" reads differently than a plain "3"); optional `onPress` makes a
 * tile a real shortcut to whatever screen explains that number, not just a
 * static readout.
 */
export function MetricTile({
  label,
  value,
  icon,
  tone = "brand",
  onPress,
}: {
  label: string;
  value: number | string;
  icon?: keyof typeof Feather.glyphMap;
  tone?: keyof typeof tones;
  onPress?: () => void;
}) {
  const toneStyle = tones[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-1 gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${onPress ? "active:bg-slate-50" : ""}`}
    >
      {icon ? (
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${toneStyle.bg}`}>
          <Feather name={icon} size={16} color={toneStyle.icon} />
        </View>
      ) : null}
      <Text className="text-2xl font-bold text-slate-950">{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </Pressable>
  );
}
