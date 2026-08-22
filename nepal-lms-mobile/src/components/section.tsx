import type { ReactNode } from "react";
import { Text, View } from "react-native";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-bold text-slate-900">{title}</Text>
      {children}
    </View>
  );
}
