import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="flex-1 items-center justify-center gap-3 bg-canvas px-8">
        <Text className="text-lg font-bold text-slate-900">This screen doesn&apos;t exist.</Text>
        <Link href="/" className="text-base font-semibold text-brand-700">
          Go to home
        </Link>
      </View>
    </>
  );
}
