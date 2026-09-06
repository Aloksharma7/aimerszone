import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { BatchCard } from "@/components/batch-card";
import { MetricTile } from "@/components/metric-tile";
import { ScreenHeader } from "@/components/screen-header";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { TeacherSessionCard } from "@/components/teacher-session-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchTeacherDashboard } from "@/lib/data/teacher";
import { timeOfDayGreeting } from "@/lib/greeting";
import type { FollowUp } from "@/types/lms";

const followUpIcon: Record<string, keyof typeof Feather.glyphMap> = {
  attendance: "check-square",
  recording: "video",
  test: "edit-3",
};

function reveal(index: number) {
  return FadeInDown.duration(320).delay(index * 60);
}

export default function TeacherDashboard() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();
  const dashboard = useQuery({ queryKey: ["teacher", "dashboard"], queryFn: fetchTeacherDashboard });

  if (dashboard.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton count={3} />
      </AppScreen>
    );
  }

  if (dashboard.isError) {
    const message = isNormalizedApiError(dashboard.error) ? dashboard.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => dashboard.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = dashboard.data;

  return (
    <AppScreen edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-6"
        refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />}
      >
        <ScreenHeader
          eyebrow="Teacher portal"
          title={user ? timeOfDayGreeting(user.name.split(" ")[0]) : "Welcome back"}
          right={
            <Pressable
              onPress={() => router.push("/(teacher)/dashboard/announcements")}
              className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm active:bg-slate-100"
            >
              <Feather name="volume-2" size={18} color="#1d4ed8" />
            </Pressable>
          }
        />

        <Animated.View entering={reveal(0)} className="flex-row flex-wrap gap-3">
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Classes today"
              value={data.metrics.classesToday}
              icon="video"
              tone="brand"
              onPress={() => router.push("/(teacher)/classes")}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Attendance to do"
              value={data.metrics.attendanceActions}
              icon="check-square"
              tone={data.metrics.attendanceActions > 0 ? "warning" : "success"}
              onPress={() => router.push("/(teacher)/attendance")}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile label="Students" value={data.metrics.activeStudents} icon="users" tone="info" />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Ongoing batches"
              value={data.metrics.ongoingBatches}
              icon="play-circle"
              tone="brand"
              onPress={() => router.push("/(teacher)/batches")}
            />
          </View>
        </Animated.View>

        {data.nextSession ? (
          <Animated.View entering={reveal(1)}>
            <TeacherSessionCard session={data.nextSession} queryKeyToInvalidate={["teacher", "dashboard"]} />
          </Animated.View>
        ) : null}

        {data.followUps.length > 0 ? (
          <Animated.View entering={reveal(2)}>
            <Section title="Needs your attention">
              <View className="gap-2">
                {data.followUps.map((item) => (
                  <FollowUpRow key={item.id} item={item} />
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}

        {data.todaySessions.length > 1 ? (
          <Animated.View entering={reveal(3)}>
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
          </Animated.View>
        ) : null}

        {data.batches.length > 0 ? (
          <Animated.View entering={reveal(4)}>
            <Section title={`My batches · ${data.metrics.assignedBatches} assigned, ${data.metrics.upcomingBatches} upcoming`}>
              <View className="gap-3">
                {data.batches.map((batch) => (
                  <BatchCard key={batch.id} batch={batch} />
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}
      </ScrollView>
    </AppScreen>
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
