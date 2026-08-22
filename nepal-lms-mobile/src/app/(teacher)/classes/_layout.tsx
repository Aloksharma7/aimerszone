import { Stack } from "expo-router";

export default function TeacherClassesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "Schedule a class" }} />
      <Stack.Screen name="recurring" options={{ title: "Recurring schedule" }} />
    </Stack>
  );
}
