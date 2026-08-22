import { Stack } from "expo-router";

export default function SupportStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Help & support" }} />
      <Stack.Screen name="new" options={{ title: "New request" }} />
    </Stack>
  );
}
