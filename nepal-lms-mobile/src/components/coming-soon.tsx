import { Text, View } from "react-native";

/** Placeholder for a tab whose real screen is built in a later phase — see docs/ROADMAP.md. */
export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-8">
      <Text className="text-xl font-bold text-slate-900">{title}</Text>
      <Text className="mt-2 text-center text-sm text-slate-500">Planned for {phase}. Navigation and auth already work — this screen is next.</Text>
    </View>
  );
}
