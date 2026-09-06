import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function SupportStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ title: "Help & support" }} />
      <Stack.Screen name="new" options={{ title: "New request" }} />
    </Stack>
  );
}
