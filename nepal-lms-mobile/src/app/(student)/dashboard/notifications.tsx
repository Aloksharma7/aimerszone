import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnnouncementCard } from "@/components/announcement-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchNotifications, markAnnouncementRead } from "@/lib/data/student";

export default function StudentNotificationsScreen() {
  const queryClient = useQueryClient();
  const notifications = useQuery({ queryKey: ["student", "notifications"], queryFn: fetchNotifications });
  const markRead = useMutation({
    mutationFn: (announcementId: string) => markAnnouncementRead(announcementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
    },
  });

  if (notifications.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (notifications.isError) {
    const message = isNormalizedApiError(notifications.error) ? notifications.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => notifications.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={notifications.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AnnouncementCard announcement={item} onPress={item.read ? undefined : () => markRead.mutate(item.id)} />
        )}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={notifications.isRefetching}
        onRefresh={() => notifications.refetch()}
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">Nothing here yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
