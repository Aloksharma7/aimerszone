import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function AdminSettingsStackLayout() {
  return (
    <Stack screenOptions={STACK_HEADER_OPTIONS}>
      <Stack.Screen name="index" options={{ title: "Platform settings" }} />
    </Stack>
  );
}
