import { Stack } from "expo-router";

export default function StaffCoursesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="new" options={{ title: "New course" }} />
    </Stack>
  );
}
