import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
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
      <AppScreen edges={["bottom"]}>
        <ListSkeleton withThumbnail={false} />
      </AppScreen>
    );
  }

  if (receipts.isError) {
    const message = isNormalizedApiError(receipts.error) ? receipts.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => receipts.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const items = receipts.data.pages.flatMap((page) => page.items);

  return (
    <AppScreen edges={["bottom"]}>
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
          <View className="mx-5">
            <EmptyState icon="file" title="No receipts yet" description="A receipt appears here once one of your payments is approved." />
          </View>
        }
        ListFooterComponent={receipts.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </AppScreen>
  );
}
