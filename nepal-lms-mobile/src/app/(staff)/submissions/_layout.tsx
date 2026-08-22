import { Stack } from "expo-router";

export default function StaffSubmissionsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#172554" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[paymentId]" options={{ title: "Submission" }} />
    </Stack>
  );
}
