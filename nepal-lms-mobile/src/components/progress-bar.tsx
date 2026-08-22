import { View } from "react-native";

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
      <View className="h-1.5 rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </View>
  );
}
