import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { Colors } from "@/constants/theme";

export default function StudentLayout() {
  const redirect = useRequirePortalRole("student");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.light.brand }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="courses" options={{ title: "Courses", tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <Feather name="credit-card" color={color} size={size} /> }} />
      <Tabs.Screen name="receipts" options={{ title: "Receipts", tabBarIcon: ({ color, size }) => <Feather name="file" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />
    </Tabs>
  );
}
