import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
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
        <Button label="Try again" onPress={() => notifications.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
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
          <EmptyState icon="bell" title="Nothing here yet" description="Announcements and updates for your courses will appear here." />
        }
      />
    </AppScreen>
  );
}
