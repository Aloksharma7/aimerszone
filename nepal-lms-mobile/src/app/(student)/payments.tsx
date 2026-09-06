import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { PaymentCard } from "@/components/payment-card";
import { ScreenHeader } from "@/components/screen-header";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchPaymentsPage } from "@/lib/data/student";

export default function StudentPayments() {
  const router = useRouter();
  const payments = useInfiniteQuery({
    queryKey: ["student", "payments"],
    queryFn: ({ pageParam }) => fetchPaymentsPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  if (payments.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton withThumbnail={false} />
      </AppScreen>
    );
  }

  if (payments.isError) {
    const message = isNormalizedApiError(payments.error) ? payments.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => payments.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const items = payments.data.pages.flatMap((page) => page.items);

  return (
    <AppScreen edges={["top"]}>
      <View className="px-5 pt-6">
        <ScreenHeader
          title="Payments"
          right={
            <Pressable
              onPress={() => router.push("/(student)/receipts")}
              className="h-11 flex-row items-center gap-1.5 rounded-full bg-white px-3.5 shadow-sm active:bg-slate-100"
            >
              <Feather name="file" size={15} color="#1d4ed8" />
              <Text className="text-xs font-bold text-brand-700">Receipts</Text>
            </Pressable>
          }
        />
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
          <View className="mx-5">
            <EmptyState icon="credit-card" title="No payments yet" description="Payments you submit for a course will show up here." />
          </View>
        }
        ListFooterComponent={payments.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
      />
    </AppScreen>
  );
}
