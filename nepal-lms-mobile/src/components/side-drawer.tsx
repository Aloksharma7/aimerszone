import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignOutButton } from "@/components/sign-out-button";
import { preferredPortalRole, type PortalRole } from "@/lib/auth/roles";
import { useSessionStore } from "@/lib/auth/session-store";
import { useDrawerStore } from "@/lib/ui/drawer-store";

const appIcon = require("@/assets/images/icon.png");

type DrawerItem = { icon: keyof typeof Feather.glyphMap; label: string; href: string };
type DrawerSection = { label?: string; items: DrawerItem[] };

/**
 * Admin's 10 destinations used to be one flat, ungrouped list — Audit Log
 * sitting next to FAQs reflects build order, not how an admin thinks about
 * their job. Grouped by what they're actually for; every other role's list
 * is short enough that grouping wouldn't add anything.
 */
const sectionsByRole: Record<PortalRole, DrawerSection[]> = {
  student: [{ items: [{ icon: "help-circle", label: "Support", href: "/(student)/support" }] }],
  teacher: [{ items: [{ icon: "volume-2", label: "Announcements", href: "/(teacher)/dashboard/announcements" }] }],
  staff: [
    {
      items: [
        { icon: "book-open", label: "New course", href: "/(staff)/courses/new" },
        { icon: "life-buoy", label: "Support tickets", href: "/(staff)/support" },
        { icon: "repeat", label: "Adjustments", href: "/(staff)/adjustments" },
        { icon: "rotate-ccw", label: "Refunds", href: "/(staff)/refunds" },
        { icon: "upload-cloud", label: "My submissions", href: "/(staff)/submissions" },
        { icon: "file-text", label: "Receipts", href: "/(staff)/receipts" },
      ],
    },
  ],
  admin: [
    {
      label: "Content",
      items: [
        { icon: "book-open", label: "Courses", href: "/(admin)/courses" },
        { icon: "calendar", label: "Batches", href: "/(admin)/batches" },
        { icon: "video", label: "Classes", href: "/(admin)/classes" },
        { icon: "folder", label: "Categories", href: "/(admin)/categories" },
      ],
    },
    {
      label: "Communication",
      items: [
        { icon: "volume-2", label: "Announcements", href: "/(admin)/announcements" },
        { icon: "help-circle", label: "FAQs", href: "/(admin)/faqs" },
      ],
    },
    {
      label: "System",
      items: [
        { icon: "link", label: "Integrations", href: "/(admin)/integrations" },
        { icon: "shield", label: "Roles", href: "/(admin)/roles" },
        { icon: "settings", label: "Platform settings", href: "/(admin)/settings" },
        { icon: "list", label: "Audit log", href: "/(admin)/audit-log" },
      ],
    },
  ],
};

/**
 * A slide-out panel for the secondary items each portal has beyond its
 * bottom tabs — not a real React Navigation Drawer navigator, deliberately:
 * that requires nesting every existing tab screen one folder deeper, which
 * would change dozens of already-working route paths across the app for a
 * feature that's purely additive. This reads plain routes and pushes to
 * them like any other button, so it carries zero risk to existing
 * navigation while still giving every portal the "side menu for extra
 * things" a bottom tab bar alone can't hold.
 */
export function SideDrawer() {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const isOpen = useDrawerStore((state) => state.isOpen);
  const close = useDrawerStore((state) => state.close);

  if (!user) return null;
  const role = preferredPortalRole(user);
  const sections = sectionsByRole[role];

  function go(href: string) {
    close();
    router.push(href as never);
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 flex-row">
        <SafeAreaView className="w-[78%] max-w-[320px] bg-white shadow-lg" edges={["top", "bottom"]}>
          <View className="flex-row items-center gap-3 border-b border-slate-100 px-5 py-5">
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-50">
              <Image source={appIcon} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-950" numberOfLines={1}>
                {user.name}
              </Text>
              <Text className="text-xs capitalize text-slate-500">{role} portal</Text>
            </View>
            <Pressable onPress={close} className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100">
              <Feather name="x" size={18} color="#64748b" />
            </Pressable>
          </View>

          <View className="flex-1 gap-4 px-3 py-3">
            {sections.map((section, index) => (
              <View key={section.label ?? index} className="gap-1">
                {section.label ? (
                  <Text className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{section.label}</Text>
                ) : null}
                {section.items.map((item) => (
                  <Pressable
                    key={item.href}
                    onPress={() => go(item.href)}
                    className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-slate-100"
                  >
                    <Feather name={item.icon} size={18} color="#1d4ed8" />
                    <Text className="text-sm font-semibold text-slate-800">{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          <View className="border-t border-slate-100 p-4">
            <SignOutButton />
          </View>
        </SafeAreaView>

        <Pressable className="flex-1 bg-black/40" onPress={close} />
      </View>
    </Modal>
  );
}

export function DrawerMenuButton() {
  const open = useDrawerStore((state) => state.open);
  return (
    <Pressable onPress={open} className="h-10 w-10 items-center justify-center rounded-xl active:bg-slate-100">
      <Feather name="menu" size={22} color="#0f172a" />
    </Pressable>
  );
}
