import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function AdminCategoriesStackLayout() {
  return (
    <Stack screenOptions={STACK_HEADER_OPTIONS}>
      <Stack.Screen name="index" options={{ title: "Course categories" }} />
    </Stack>
  );
}
