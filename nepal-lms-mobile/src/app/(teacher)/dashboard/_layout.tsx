import { Stack } from "expo-router";

export default function TeacherDashboardStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="announcements" options={{ title: "Announcements" }} />
      <Stack.Screen name="announcements-new" options={{ title: "New announcement" }} />
    </Stack>
  );
}
