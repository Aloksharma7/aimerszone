import { Text, View } from "react-native";

export function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <Text className="text-2xl font-bold text-slate-950">{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}
