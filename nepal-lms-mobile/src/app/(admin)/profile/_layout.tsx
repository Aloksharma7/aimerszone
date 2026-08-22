import { Stack } from "expo-router";

export default function AdminProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ title: "Edit profile" }} />
      <Stack.Screen name="password" options={{ title: "Change password" }} />
      <Stack.Screen name="two-factor" options={{ title: "Two-factor authentication" }} />
      <Stack.Screen name="sessions" options={{ title: "Active sessions" }} />
    </Stack>
  );
}
