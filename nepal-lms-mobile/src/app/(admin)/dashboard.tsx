import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { MetricTile } from "@/components/metric-tile";
import { ScreenHeader } from "@/components/screen-header";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdminDashboard } from "@/lib/data/admin";
import { useSessionStore } from "@/lib/auth/session-store";
import { timeOfDayGreeting } from "@/lib/greeting";
import type { AdminAttentionItem } from "@/types/lms";

const toneStyle: Record<AdminAttentionItem["tone"], { bg: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  amber: { bg: "bg-warning-100", icon: "clock", color: "#a16207" },
  blue: { bg: "bg-info-100", icon: "check-square", color: "#0369a1" },
  red: { bg: "bg-danger-100", icon: "alert-triangle", color: "#b91c1c" },
  green: { bg: "bg-success-100", icon: "check-circle", color: "#15803d" },
};

function reveal(index: number) {
  return FadeInDown.duration(320).delay(index * 60);
}

export default function AdminDashboard() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();
  const dashboard = useQuery({ queryKey: ["admin", "dashboard"], queryFn: fetchAdminDashboard });

  if (dashboard.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton count={3} withThumbnail={false} />
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
        <ScreenHeader eyebrow="Admin portal" title={user ? timeOfDayGreeting(user.name.split(" ")[0]) : "Welcome back"} />

        <Animated.View entering={reveal(0)} className="flex-row flex-wrap gap-3">
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Active students"
              value={data.metrics.activeStudents}
              icon="users"
              tone="brand"
              onPress={() => router.push("/(admin)/users")}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Active batches"
              value={data.metrics.activeBatches}
              icon="calendar"
              tone="info"
              onPress={() => router.push("/(admin)/batches")}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Published courses"
              value={data.metrics.publishedCourses}
              icon="book-open"
              tone="brand"
              onPress={() => router.push("/(admin)/courses")}
            />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile label="Active enrollments" value={data.metrics.activeEnrollments} icon="check-circle" tone="success" />
          </View>
          <View className="min-w-[47%] flex-1">
            <MetricTile
              label="Pending payments"
              value={data.metrics.pendingPayments}
              icon="clock"
              tone={data.metrics.pendingPayments > 0 ? "warning" : "success"}
            />
          </View>
        </Animated.View>

        <Animated.View entering={reveal(1)} className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-success-100">
            <Feather name="trending-up" size={18} color="#15803d" />
          </View>
          <View>
            <Text className="text-xs text-slate-500">Collections this month</Text>
            <Text className="mt-0.5 text-2xl font-bold text-slate-950">Rs. {data.metrics.collectionsMonthNpr.toLocaleString("en-IN")}</Text>
          </View>
        </Animated.View>

        {data.attention.length > 0 ? (
          <Animated.View entering={reveal(2)}>
            <Section title="Needs attention">
              <View className="gap-2">
                {data.attention.map((item) => (
                  <AttentionRow key={item.id} item={item} />
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function AttentionRow({ item }: { item: AdminAttentionItem }) {
  const style = toneStyle[item.tone];
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className={`h-10 w-10 items-center justify-center rounded-xl ${style.bg}`}>
        <Feather name={style.icon} size={18} color={style.color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{item.title}</Text>
        <Text className="mt-0.5 text-xs text-slate-500">{item.detail}</Text>
      </View>
    </View>
  );
}
