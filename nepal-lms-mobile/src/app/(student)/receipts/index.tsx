import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ReceiptCard } from "@/components/receipt-card";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchReceiptsPage } from "@/lib/data/student";

export default function StudentReceipts() {
  const receipts = useInfiniteQuery({
    queryKey: ["student", "receipts"],
    queryFn: ({ pageParam }) => fetchReceiptsPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  if (receipts.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton withThumbnail={false} />
      </SafeAreaView>
    );
  }

  if (receipts.isError) {
    const message = isNormalizedApiError(receipts.error) ? receipts.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => receipts.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const items = receipts.data.pages.flatMap((page) => page.items);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Receipts</Text>
      </View>
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <ReceiptCard receipt={item} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        refreshing={receipts.isRefetching && !receipts.isFetchingNextPage}
        onRefresh={() => receipts.refetch()}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (receipts.hasNextPage && !receipts.isFetchingNextPage) receipts.fetchNextPage();
        }}
        ListEmptyComponent={
          <View className="mx-5 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">No receipts have been issued yet.</Text>
          </View>
        }
        ListFooterComponent={receipts.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </SafeAreaView>
  );
}
