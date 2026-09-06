import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function StaffCoursesStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="new" options={{ title: "New course" }} />
    </Stack>
  );
}
