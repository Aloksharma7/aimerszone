import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile } from "@/components/metric-tile";
import { PaymentQueueCard } from "@/components/payment-queue-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchStaffPaymentSubmissionsPage } from "@/lib/data/staff";
import { FlashList } from "@shopify/flash-list";

const filters = [
  { value: undefined, label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function StaffSubmissionsScreen() {
  const [status, setStatus] = useState<string | undefined>(undefined);

  const submissions = useInfiniteQuery({
    queryKey: ["staff", "submissions", status],
    queryFn: ({ pageParam }) => fetchStaffPaymentSubmissionsPage(pageParam, status),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = submissions.data?.pages.flatMap((page) => page.items) ?? [];
  const total = submissions.data?.pages[0]?.total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">My submissions</Text>

        {submissions.data ? (
          <View className="flex-row gap-3">
            <MetricTile label="Total captured" value={total} />
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {filters.map((filter) => {
              const selected = status === filter.value;
              return (
                <Pressable
                  key={filter.label}
                  onPress={() => setStatus(filter.value)}
                  className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                >
                  <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {submissions.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : submissions.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">
            {isNormalizedApiError(submissions.error) ? submissions.error.message : "Something went wrong."}
          </Text>
          <Pressable onPress={() => submissions.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <PaymentQueueCard payment={item} basePath="/(staff)/submissions" />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={submissions.isRefetching && !submissions.isFetchingNextPage}
          onRefresh={() => submissions.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (submissions.hasNextPage && !submissions.isFetchingNextPage) submissions.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">You haven&apos;t captured any payments yet.</Text>
            </View>
          }
          ListFooterComponent={submissions.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </SafeAreaView>
  );
}
