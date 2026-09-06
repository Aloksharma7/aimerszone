import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function StaffSupportStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[ticketId]" options={{ title: "Ticket" }} />
    </Stack>
  );
}
