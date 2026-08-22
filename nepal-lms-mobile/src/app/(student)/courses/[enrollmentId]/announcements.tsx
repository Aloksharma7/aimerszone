import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnnouncementCard } from "@/components/announcement-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseAnnouncements } from "@/lib/data/course";

export default function CourseAnnouncementsScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const announcements = useQuery({
    queryKey: ["student", "course", enrollmentId, "announcements"],
    queryFn: () => fetchCourseAnnouncements(enrollmentId),
  });

  if (announcements.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (announcements.isError) {
    const message = isNormalizedApiError(announcements.error) ? announcements.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => announcements.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={announcements.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnnouncementCard announcement={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={announcements.isRefetching}
        onRefresh={() => announcements.refetch()}
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">No announcements have been posted for this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
