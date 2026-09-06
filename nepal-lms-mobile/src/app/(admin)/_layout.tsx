import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { TAB_BAR_SCREEN_OPTIONS } from "@/constants/navigation";

export default function AdminLayout() {
  const redirect = useRequirePortalRole("admin");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={TAB_BAR_SCREEN_OPTIONS}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Feather name="users" color={color} size={size} /> }} />
      <Tabs.Screen name="reports" options={{ title: "Reports", tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />

      {/* Reachable only from the side drawer — expo-router adds every route
          under this Tabs layout to the bottom bar by default, so each one
          needs an explicit href:null or it silently becomes an extra tab. */}
      <Tabs.Screen name="announcements" options={{ href: null }} />
      <Tabs.Screen name="audit-log" options={{ href: null }} />
      <Tabs.Screen name="batches" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="classes" options={{ href: null }} />
      <Tabs.Screen name="courses" options={{ href: null }} />
      <Tabs.Screen name="faqs" options={{ href: null }} />
      <Tabs.Screen name="integrations" options={{ href: null }} />
      <Tabs.Screen name="roles" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
