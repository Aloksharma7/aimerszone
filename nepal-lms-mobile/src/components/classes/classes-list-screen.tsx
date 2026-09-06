import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { ScreenHeader } from "@/components/screen-header";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherClassesPage, startClassSession } from "@/lib/data/teacher";
import type { TeacherSession } from "@/types/lms";

const toneByStatus: Record<TeacherSession["status"], "warning" | "info" | "success" | "neutral" | "danger"> = {
  live: "danger",
  scheduled: "info",
  completed: "success",
  rescheduled: "warning",
  cancelled: "neutral",
};

type ClassesHref = "/(teacher)/classes/new" | "/(admin)/classes/new" | "/(teacher)/classes/recurring" | "/(admin)/classes/recurring";

export function ClassesListScreen({ newHref, recurringHref }: { newHref: ClassesHref; recurringHref: ClassesHref }) {
  const router = useRouter();
  const classes = useInfiniteQuery({
    queryKey: ["teacher", "classes"],
    queryFn: ({ pageParam }) => fetchTeacherClassesPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  if (classes.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["top"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (classes.isError) {
    const message = isNormalizedApiError(classes.error) ? classes.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => classes.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const items = classes.data.pages.flatMap((page) => page.items);

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <ScreenHeader title="Classes" />
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.push(newHref)}
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New class</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(recurringHref)}
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 active:bg-slate-100"
          >
            <Feather name="repeat" size={16} color="#1d4ed8" />
            <Text className="text-sm font-bold text-brand-700">Recurring</Text>
          </Pressable>
        </View>
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <ClassRow session={item} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        refreshing={classes.isRefetching && !classes.isFetchingNextPage}
        onRefresh={() => classes.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (classes.hasNextPage && !classes.isFetchingNextPage) classes.fetchNextPage();
        }}
        ListEmptyComponent={
          <View className="mx-5">
            <EmptyState icon="video" title="No classes scheduled" description="Classes you schedule will appear here." />
          </View>
        }
        ListFooterComponent={classes.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </AppScreen>
  );
}

function ClassRow({ session }: { session: TeacherSession }) {
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: () => startClassSession(session.id),
    onSuccess: async (destination) => {
      await queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
      await Linking.openURL(destination.redirectUrl);
    },
  });

  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{session.title}</Text>
        <StatusBadge label={session.status} tone={toneByStatus[session.status]} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {session.batchTitle} · {session.date}, {session.timeRange}
      </Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {session.studentsCount} student{session.studentsCount === 1 ? "" : "s"}
      </Text>

      {session.canStart && session.startAvailable ? (
        <Pressable
          onPress={() => start.mutate()}
          disabled={start.isPending}
          className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {start.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Start class</Text>}
        </Pressable>
      ) : null}
      {start.isError ? (
        <Text className="mt-2 text-xs text-danger-700">{isNormalizedApiError(start.error) ? start.error.message : "Could not start the class."}</Text>
      ) : null}
    </View>
  );
}
