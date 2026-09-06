import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { TAB_BAR_SCREEN_OPTIONS } from "@/constants/navigation";

export default function StaffLayout() {
  const redirect = useRequirePortalRole("staff");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={TAB_BAR_SCREEN_OPTIONS}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="students" options={{ title: "Students", tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <Feather name="credit-card" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />

      {/* Reachable only from the side drawer — see the admin layout's comment on why href:null is required here. */}
      <Tabs.Screen name="adjustments" options={{ href: null }} />
      <Tabs.Screen name="courses" options={{ href: null }} />
      <Tabs.Screen name="receipts" options={{ href: null }} />
      <Tabs.Screen name="refunds" options={{ href: null }} />
      <Tabs.Screen name="submissions" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
    </Tabs>
  );
}
