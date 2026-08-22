import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { Colors } from "@/constants/theme";

export default function AdminLayout() {
  const redirect = useRequirePortalRole("admin");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.light.brand }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
    </Tabs>
  );
}
