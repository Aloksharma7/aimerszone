/**
 * The one shell every portal follows: a native Stack header (back button,
 * brand-navy bar) for pushed/detail screens, and a bottom tab bar style for
 * each portal's root Tabs navigator. Defined once so every `_layout.tsx`
 * imports the same values instead of re-typing them — see
 * docs/CODING-STANDARDS.md on avoiding drift across portals.
 */

import { Colors } from "@/constants/theme";

export const STACK_HEADER_OPTIONS = {
  headerStyle: { backgroundColor: Colors.light.brandDark },
  headerTintColor: "#ffffff",
  headerTitleStyle: { fontWeight: "700" as const },
};

export const TAB_BAR_SCREEN_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: Colors.light.brand,
  tabBarInactiveTintColor: "#94a3b8",
  tabBarStyle: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
    elevation: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
  tabBarItemStyle: { paddingTop: 4 },
};
