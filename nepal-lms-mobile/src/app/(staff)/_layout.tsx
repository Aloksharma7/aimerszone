import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { Colors } from "@/constants/theme";

export default function StaffLayout() {
  const redirect = useRequirePortalRole("staff");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.light.brand }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="students" options={{ title: "Students", tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <Feather name="credit-card" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
    </Tabs>
  );
}
