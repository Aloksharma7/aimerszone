import { Stack } from "expo-router";

export default function StaffStudentsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New student" }} />
      <Stack.Screen name="[studentId]" options={{ title: "Student" }} />
    </Stack>
  );
}
