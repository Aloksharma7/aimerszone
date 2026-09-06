import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function StaffStudentsStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New student" }} />
      <Stack.Screen name="[studentId]" options={{ title: "Student" }} />
    </Stack>
  );
}
