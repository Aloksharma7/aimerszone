import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
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
        <Button label="Try again" onPress={() => announcements.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <FlatList
        data={announcements.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnnouncementCard announcement={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={announcements.isRefetching}
        onRefresh={() => announcements.refetch()}
        ListEmptyComponent={
          <EmptyState icon="volume-2" title="No announcements" description="Your teacher hasn't posted anything for this batch yet." />
        }
      />
    </AppScreen>
  );
}
