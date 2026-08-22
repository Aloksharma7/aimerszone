import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { DashboardAnnouncement } from "@/types/lms";

export function AnnouncementCard({ announcement, onPress }: { announcement: DashboardAnnouncement; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className={`rounded-2xl border border-slate-100 bg-white shadow-sm p-4 ${onPress ? "active:bg-slate-50" : ""}`}>
      <View className="flex-row items-center gap-2">
        {announcement.pinned ? <Feather name="bookmark" size={12} color="#1d4ed8" /> : null}
        <Text className="flex-1 text-sm font-semibold text-slate-900">{announcement.title}</Text>
        {!announcement.read ? <View className="h-2 w-2 rounded-full bg-brand-600" /> : null}
      </View>
      <Text className="mt-1 text-xs text-slate-500" numberOfLines={3}>
        {announcement.body}
      </Text>
      <Text className="mt-1.5 text-[11px] text-slate-400">{announcement.date}</Text>
    </Pressable>
  );
}
