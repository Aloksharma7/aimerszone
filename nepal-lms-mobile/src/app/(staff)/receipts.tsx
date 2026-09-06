import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { MetricTile } from "@/components/metric-tile";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchLedgerReceipts } from "@/lib/data/staff";
import type { LedgerReceipt } from "@/types/lms";

export default function StaffReceiptsScreen() {
  const receipts = useQuery({ queryKey: ["staff", "receipts"], queryFn: fetchLedgerReceipts });

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Receipts</Text>

        {receipts.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              <MetricTile label="Today" value={receipts.data.metrics.today} />
              <MetricTile label="This month" value={receipts.data.metrics.month} />
              <MetricTile label="Adjusted" value={receipts.data.metrics.adjusted} />
            </View>
          </ScrollView>
        ) : null}
      </View>

      {receipts.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : receipts.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(receipts.error) ? receipts.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => receipts.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={receipts.data.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReceiptRow receipt={item} />}
          contentContainerClassName="gap-3 px-5 py-4"
          refreshing={receipts.isRefetching}
          onRefresh={() => receipts.refetch()}
          ListEmptyComponent={
            <EmptyState icon="file" title="No receipts yet" description="Receipts for approved payments will appear here." />
          }
        />
      )}
    </AppScreen>
  );
}

function ReceiptRow({ receipt }: { receipt: LedgerReceipt }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {receipt.studentName}
        </Text>
        <Text className="text-sm font-bold text-slate-900">Rs. {receipt.amountNpr.toLocaleString("en-IN")}</Text>
      </View>
      <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
        {receipt.courseTitle} · {receipt.paymentId}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-400">{receipt.issuedAt}</Text>
    </View>
  );
}
