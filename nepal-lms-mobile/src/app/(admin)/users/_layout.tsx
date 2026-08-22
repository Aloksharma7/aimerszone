import { Stack } from "expo-router";

export default function AdminUsersStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New account" }} />
      <Stack.Screen name="[userId]" options={{ title: "User" }} />
    </Stack>
  );
}
