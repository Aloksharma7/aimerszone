import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaymentCard } from "@/components/payment-card";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchPaymentsPage } from "@/lib/data/student";

export default function StudentPayments() {
  const payments = useInfiniteQuery({
    queryKey: ["student", "payments"],
    queryFn: ({ pageParam }) => fetchPaymentsPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  if (payments.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton withThumbnail={false} />
      </SafeAreaView>
    );
  }

  if (payments.isError) {
    const message = isNormalizedApiError(payments.error) ? payments.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => payments.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const items = payments.data.pages.flatMap((page) => page.items);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Payments</Text>
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <PaymentCard payment={item} />
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
          <View className="mx-5 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">You haven&apos;t submitted any payments yet.</Text>
          </View>
        }
        ListFooterComponent={payments.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </SafeAreaView>
  );
}
