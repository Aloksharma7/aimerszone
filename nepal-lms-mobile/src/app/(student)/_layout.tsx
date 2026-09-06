import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useRequirePortalRole } from "@/lib/auth/use-require-portal-role";
import { TAB_BAR_SCREEN_OPTIONS } from "@/constants/navigation";

export default function StudentLayout() {
  const redirect = useRequirePortalRole("student");
  if (redirect) return redirect;

  return (
    <Tabs screenOptions={TAB_BAR_SCREEN_OPTIONS}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="courses" options={{ title: "Courses", tabBarIcon: ({ color, size }) => <Feather name="book-open" color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: "Payments", tabBarIcon: ({ color, size }) => <Feather name="credit-card" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }} />

      {/*
        Receipts used to be a 5th tab. A receipt is checked far less often
        than a payment's status and shares the same underlying data — it's
        now reached from Payments' header and from Profile instead of
        holding its own permanent nav slot. See the architecture doc's
        student IA section. Reachable only from those two places now — see
        the admin layout's comment on why href:null is required here.
      */}
      <Tabs.Screen name="receipts" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
    </Tabs>
  );
}
