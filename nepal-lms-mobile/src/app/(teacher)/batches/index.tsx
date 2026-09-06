import { useQuery } from "@tanstack/react-query";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { BatchCard } from "@/components/batch-card";
import { ScreenHeader } from "@/components/screen-header";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherBatches } from "@/lib/data/teacher";

export default function TeacherBatchesScreen() {
  const batches = useQuery({ queryKey: ["teacher", "batches"], queryFn: fetchTeacherBatches });

  if (batches.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton />
      </AppScreen>
    );
  }

  if (batches.isError) {
    const message = isNormalizedApiError(batches.error) ? batches.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => batches.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["top"]}>
      <View className="px-5 pt-6">
        <ScreenHeader title="My batches" />
      </View>
      <FlatList
        data={batches.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BatchCard batch={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={batches.isRefetching}
        onRefresh={() => batches.refetch()}
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">You&apos;re not assigned to any batches yet.</Text>
          </View>
        }
      />
    </AppScreen>
  );
}
