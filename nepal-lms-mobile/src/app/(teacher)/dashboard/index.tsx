import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BatchCard } from "@/components/batch-card";
import { MetricTile } from "@/components/metric-tile";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { DrawerMenuButton } from "@/components/side-drawer";
import { TeacherSessionCard } from "@/components/teacher-session-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchTeacherDashboard } from "@/lib/data/teacher";
import type { FollowUp } from "@/types/lms";

const followUpIcon: Record<string, keyof typeof Feather.glyphMap> = {
  attendance: "check-square",
  recording: "video",
  test: "edit-3",
};

export default function TeacherDashboard() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();
  const dashboard = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: fetchTeacherDashboard });

  if (dashboard.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton count={3} />
      </SafeAreaView>
    );
  }

  if (dashboard.isError) {
    const message = isNormalizedApiError(dashboard.error) ? dashboard.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => dashboard.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = dashboard.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-6"
        refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-start gap-2">
            <DrawerMenuButton />
            <View>
              <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">Teacher portal</Text>
              <Text className="mt-1 text-2xl font-bold text-slate-950">{user ? `Hi, ${user.name.split(" ")[0]}` : "Welcome back"}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(teacher)/dashboard/announcements")}
            className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm active:bg-slate-100"
          >
            <Feather name="volume-2" size={18} color="#1d4ed8" />
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <MetricTile label="Classes today" value={data.metrics.classesToday} />
          <MetricTile label="Attendance to do" value={data.metrics.attendanceActions} />
          <MetricTile label="Students" value={data.metrics.activeStudents} />
        </View>

        {data.nextSession ? <TeacherSessionCard session={data.nextSession} queryKeyToInvalidate={["teacher", "dashboard"]} /> : null}

        {data.followUps.length > 0 ? (
          <Section title="Needs your attention">
            <View className="gap-2">
              {data.followUps.map((item) => (
                <FollowUpRow key={item.id} item={item} />
              ))}
            </View>
          </Section>
        ) : null}

        {data.todaySessions.length > 1 ? (
          <Section title="Today's classes">
            <View className="gap-2">
              {data.todaySessions.map((session) => (
                <View key={session.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <Text className="text-sm font-semibold text-slate-900">{session.title}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">
                    {session.batchTitle} · {session.timeRange}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {data.batches.length > 0 ? (
          <Section title="My batches">
            <View className="gap-3">
              {data.batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function FollowUpRow({ item }: { item: FollowUp }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-warning-100">
        <Feather name={followUpIcon[item.type] ?? "alert-circle"} size={18} color="#a16207" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{item.title}</Text>
        <Text className="mt-0.5 text-xs text-slate-500">{item.detail}</Text>
      </View>
    </View>
  );
}
