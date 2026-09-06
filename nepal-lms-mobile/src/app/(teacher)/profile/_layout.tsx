import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function TeacherProfileStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ title: "Edit profile" }} />
      <Stack.Screen name="password" options={{ title: "Change password" }} />
      <Stack.Screen name="two-factor" options={{ title: "Two-factor authentication" }} />
      <Stack.Screen name="sessions" options={{ title: "Active sessions" }} />
    </Stack>
  );
}
