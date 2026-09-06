import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { PaymentQueueCard } from "@/components/payment-queue-card";
import { ScreenHeader } from "@/components/screen-header";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchPaymentQueuePage } from "@/lib/data/staff";

const filters = [
  { value: undefined, label: "All" },
  { value: "under_review", label: "Under review" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function StaffPaymentsScreen() {
  const [status, setStatus] = useState<string | undefined>(undefined);

  const payments = useInfiniteQuery({
    queryKey: ["staff", "payments", status],
    queryFn: ({ pageParam }) => fetchPaymentQueuePage(pageParam, status),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = payments.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <ScreenHeader title="Payment review" />
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

      {payments.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : payments.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(payments.error) ? payments.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => payments.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <PaymentQueueCard payment={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={payments.isRefetching && !payments.isFetchingNextPage}
          onRefresh={() => payments.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (payments.hasNextPage && !payments.isFetchingNextPage) payments.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">Nothing here.</Text>
            </View>
          }
          ListFooterComponent={payments.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </AppScreen>
  );
}
