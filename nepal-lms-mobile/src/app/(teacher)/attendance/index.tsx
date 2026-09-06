import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { MetricTile } from "@/components/metric-tile";
import { ScreenHeader } from "@/components/screen-header";
import { StatusBadge } from "@/components/status-badge";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAttendanceOverview } from "@/lib/data/teacher";
import type { AttendanceListItem } from "@/types/lms";

export default function TeacherAttendanceScreen() {
  const overview = useQuery({ queryKey: ["teacher", "attendance"], queryFn: fetchAttendanceOverview });

  if (overview.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton withThumbnail={false} />
      </AppScreen>
    );
  }

  if (overview.isError) {
    const message = isNormalizedApiError(overview.error) ? overview.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => overview.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = overview.data;

  return (
    <AppScreen edges={["top"]}>
      <View className="px-5 pt-6">
        <ScreenHeader title="Attendance" />
      </View>
      <FlatList
        data={data.sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionRow session={item} />}
        contentContainerClassName="gap-3 px-5 py-6"
        refreshing={overview.isRefetching}
        onRefresh={() => overview.refetch()}
        ListHeaderComponent={
          <View className="mb-4 flex-row gap-3">
            <MetricTile label="Awaiting" value={data.metrics.awaiting} />
            <MetricTile label="Finalized this week" value={data.metrics.finalizedThisWeek} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="check-square" title="Nothing to mark yet" description="Classes that need an attendance register will appear here after they finish." />
        }
      />
    </AppScreen>
  );
}

function SessionRow({ session }: { session: AttendanceListItem }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(teacher)/attendance/[sessionId]", params: { sessionId: session.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{session.title}</Text>
        <StatusBadge label={session.status === "finalized" ? "Finalized" : "Pending"} tone={session.status === "finalized" ? "success" : "warning"} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {session.batchTitle} · {session.startsAt}
      </Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {session.studentsCount} student{session.studentsCount === 1 ? "" : "s"}
      </Text>
    </Pressable>
  );
}
