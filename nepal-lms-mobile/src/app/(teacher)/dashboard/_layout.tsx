import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function TeacherDashboardStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="announcements" options={{ title: "Announcements" }} />
      <Stack.Screen name="announcements-new" options={{ title: "New announcement" }} />
    </Stack>
  );
}
