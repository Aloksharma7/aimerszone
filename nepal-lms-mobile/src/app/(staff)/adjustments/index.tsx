import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile } from "@/components/metric-tile";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdjustments } from "@/lib/data/staff";
import type { LedgerAdjustment } from "@/types/lms";

export default function StaffAdjustmentsScreen() {
  const router = useRouter();
  const [type, setType] = useState<string | undefined>(undefined);
  const adjustments = useQuery({ queryKey: ["staff", "adjustments"], queryFn: fetchAdjustments });

  const types = useMemo(() => [...new Set((adjustments.data?.items ?? []).map((item) => item.type))].sort(), [adjustments.data]);
  const items = (adjustments.data?.items ?? []).filter((item) => !type || item.type === type);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-950">Adjustments</Text>
          <Pressable
            onPress={() => router.push("/(staff)/adjustments/new")}
            className="h-10 flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New</Text>
          </Pressable>
        </View>

        {adjustments.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              <MetricTile label="Pending refunds" value={adjustments.data.metrics.pending} />
              <MetricTile label="Completed (mo)" value={adjustments.data.metrics.completedMonth} />
              <MetricTile label="Refunded (mo)" value={`Rs. ${adjustments.data.metrics.refundedMonthNpr.toLocaleString("en-IN")}`} />
            </View>
          </ScrollView>
        ) : null}

        {types.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {[undefined, ...types].map((option) => {
                const selected = type === option;
                return (
                  <Pressable
                    key={option ?? "all"}
                    onPress={() => setType(option)}
                    className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium capitalize ${selected ? "text-white" : "text-slate-700"}`}>{option ?? "All"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {adjustments.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : adjustments.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(adjustments.error) ? adjustments.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => adjustments.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AdjustmentRow adjustment={item} />}
          contentContainerClassName="gap-3 px-5 py-4"
          refreshing={adjustments.isRefetching}
          onRefresh={() => adjustments.refetch()}
          ListEmptyComponent={
            <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No adjustments recorded yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function AdjustmentRow({ adjustment }: { adjustment: LedgerAdjustment }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {adjustment.studentName}
        </Text>
        <Text className={`text-sm font-bold ${adjustment.amountNpr < 0 ? "text-success-700" : "text-slate-900"}`}>
          Rs. {Math.abs(adjustment.amountNpr).toLocaleString("en-IN")}
        </Text>
      </View>
      <Text className="mt-0.5 text-xs capitalize text-slate-500">
        {adjustment.type} · {adjustment.paymentId}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-600" numberOfLines={2}>
        {adjustment.reason}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-400">{adjustment.createdAt}</Text>
    </View>
  );
}
