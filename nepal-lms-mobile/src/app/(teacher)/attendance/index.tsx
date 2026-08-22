import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile } from "@/components/metric-tile";
import { StatusBadge } from "@/components/status-badge";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAttendanceOverview } from "@/lib/data/teacher";
import type { AttendanceListItem } from "@/types/lms";

export default function TeacherAttendanceScreen() {
  const overview = useQuery({ queryKey: ["teacher", "attendance"], queryFn: fetchAttendanceOverview });

  if (overview.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton withThumbnail={false} />
      </SafeAreaView>
    );
  }

  if (overview.isError) {
    const message = isNormalizedApiError(overview.error) ? overview.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => overview.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = overview.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <FlatList
        data={data.sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionRow session={item} />}
        contentContainerClassName="gap-3 px-5 py-6"
        refreshing={overview.isRefetching}
        onRefresh={() => overview.refetch()}
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <Text className="text-2xl font-bold text-slate-950">Attendance</Text>
            <View className="flex-row gap-3">
              <MetricTile label="Awaiting" value={data.metrics.awaiting} />
              <MetricTile label="Finalized this week" value={data.metrics.finalizedThisWeek} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No past classes need a register yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
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
