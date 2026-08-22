import { Text, View } from "react-native";

const tones = {
  success: "bg-success-100 text-success-700",
  warning: "bg-warning-100 text-warning-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-info-100 text-info-700",
  neutral: "bg-slate-100 text-slate-600",
} as const;

export function StatusBadge({ label, tone }: { label: string; tone: keyof typeof tones }) {
  const [bgClass, textClass] = tones[tone].split(" ");
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${bgClass}`}>
      <Text className={`text-xs font-semibold ${textClass}`}>{label}</Text>
    </View>
  );
}
