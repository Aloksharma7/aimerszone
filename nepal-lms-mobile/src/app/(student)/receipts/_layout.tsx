import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function ReceiptsStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ title: "Receipts" }} />
      <Stack.Screen name="[receiptId]" options={{ title: "Receipt" }} />
    </Stack>
  );
}
