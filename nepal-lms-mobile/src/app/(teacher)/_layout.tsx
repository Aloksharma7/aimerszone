import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { TAB_BAR_SCREEN_OPTIONS } from "@/constants/navigation";

export default function TeacherLayout() {
  const redirect = useRequirePortalRole("teacher");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={TAB_BAR_SCREEN_OPTIONS}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="batches" options={{ title: "Batches", tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} /> }} />
      <Tabs.Screen name="classes" options={{ title: "Classes", tabBarIcon: ({ color, size }) => <Feather name="calendar" color={color} size={size} /> }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <Feather name="check-square" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
    </Tabs>
  );
}
