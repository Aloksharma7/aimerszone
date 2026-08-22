import { Stack } from "expo-router";

export default function AdminRolesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New role" }} />
      <Stack.Screen name="[roleId]" options={{ title: "Role" }} />
    </Stack>
  );
}
