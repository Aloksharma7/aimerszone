import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnnouncementCard } from "@/components/announcement-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherAnnouncementsPage } from "@/lib/data/teacher";

export default function TeacherAnnouncementsScreen() {
  const router = useRouter();
  const announcements = useInfiniteQuery({
    queryKey: ["teacher", "announcements"],
    queryFn: ({ pageParam }) => fetchTeacherAnnouncementsPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
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

  const items = announcements.data.pages.flatMap((page) => page.items);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <View className="px-5 pb-2 pt-4">
        <Pressable
          onPress={() => router.push("/(teacher)/dashboard/announcements-new")}
          className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text className="text-sm font-bold text-white">New announcement</Text>
        </Pressable>
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <AnnouncementCard announcement={item} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshing={announcements.isRefetching && !announcements.isFetchingNextPage}
        onRefresh={() => announcements.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (announcements.hasNextPage && !announcements.isFetchingNextPage) announcements.fetchNextPage();
        }}
        ListEmptyComponent={
          <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">You haven&apos;t posted any announcements yet.</Text>
          </View>
        }
        ListFooterComponent={announcements.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </SafeAreaView>
  );
}
