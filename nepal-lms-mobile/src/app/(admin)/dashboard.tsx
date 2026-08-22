import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile } from "@/components/metric-tile";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { DrawerMenuButton } from "@/components/side-drawer";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdminDashboard } from "@/lib/data/admin";
import { useSessionStore } from "@/lib/auth/session-store";
import type { AdminAttentionItem } from "@/types/lms";

const toneStyle: Record<AdminAttentionItem["tone"], { bg: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  amber: { bg: "bg-warning-100", icon: "clock", color: "#a16207" },
  blue: { bg: "bg-info-100", icon: "check-square", color: "#0369a1" },
  red: { bg: "bg-danger-100", icon: "alert-triangle", color: "#b91c1c" },
  green: { bg: "bg-success-100", icon: "check-circle", color: "#15803d" },
};

export default function AdminDashboard() {
  const user = useSessionStore((state) => state.user);
  const dashboard = useQuery({ queryKey: ["admin", "dashboard"], queryFn: fetchAdminDashboard });

  if (dashboard.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton count={3} withThumbnail={false} />
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
        <View className="flex-row items-start gap-2">
          <DrawerMenuButton />
          <View>
            <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">Admin portal</Text>
            <Text className="mt-1 text-2xl font-bold text-slate-950">{user ? `Hi, ${user.name.split(" ")[0]}` : "Welcome back"}</Text>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <MetricTile label="Active students" value={data.metrics.activeStudents} />
          <MetricTile label="Active batches" value={data.metrics.activeBatches} />
          <MetricTile label="Pending payments" value={data.metrics.pendingPayments} />
        </View>

        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-xs text-slate-500">Collections this month</Text>
          <Text className="mt-1 text-2xl font-bold text-slate-950">Rs. {data.metrics.collectionsMonthNpr.toLocaleString("en-IN")}</Text>
        </View>

        {data.attention.length > 0 ? (
          <Section title="Needs attention">
            <View className="gap-2">
              {data.attention.map((item) => (
                <AttentionRow key={item.id} item={item} />
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
