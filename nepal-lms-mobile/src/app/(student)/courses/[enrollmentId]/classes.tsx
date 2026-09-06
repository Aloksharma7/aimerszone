import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseClasses } from "@/lib/data/course";
import { joinClassSession } from "@/lib/data/student";
import type { LiveSession } from "@/types/lms";

export default function CourseClassesScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const classes = useQuery({ queryKey: ["student", "course", enrollmentId, "classes"], queryFn: () => fetchCourseClasses(enrollmentId) });

  if (classes.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (classes.isError) {
    const message = isNormalizedApiError(classes.error) ? classes.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => classes.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <FlatList
        data={classes.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ClassRow session={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={classes.isRefetching}
        onRefresh={() => classes.refetch()}
        ListEmptyComponent={
          <EmptyState icon="calendar" title="No classes scheduled" description="Upcoming classes for this batch will appear here." />
        }
      />
    </AppScreen>
  );
}

function ClassRow({ session }: { session: LiveSession }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinClassSession(session.id),
    onSuccess: async (destination) => {
      queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
      await Linking.openURL(destination.url);
    },
  });

  return (
    <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{session.topic}</Text>
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {session.date}, {session.timeRange} · {session.teacherName}
      </Text>

      {session.joinAvailable ? (
        <Pressable
          onPress={() => join.mutate()}
          disabled={join.isPending}
          className="mt-3 h-10 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {join.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Join class</Text>}
        </Pressable>
      ) : (
        <View className="mt-3 self-start">
          <StatusBadge label={session.actionReason || "Not open yet"} tone="neutral" />
        </View>
      )}

      {join.isError ? (
        <Text className="mt-2 text-xs text-danger-700">{isNormalizedApiError(join.error) ? join.error.message : "Could not open the class link."}</Text>
      ) : null}
    </View>
  );
}
