import { Stack } from "expo-router";

export default function AdminBatchesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New batch" }} />
      <Stack.Screen name="[batchId]" options={{ title: "Batch" }} />
    </Stack>
  );
}
