import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BatchCard } from "@/components/batch-card";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherBatches } from "@/lib/data/teacher";

export default function TeacherBatchesScreen() {
  const batches = useQuery({ queryKey: ["teacher", "batches"], queryFn: fetchTeacherBatches });

  if (batches.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton />
      </SafeAreaView>
    );
  }

  if (batches.isError) {
    const message = isNormalizedApiError(batches.error) ? batches.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => batches.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">My batches</Text>
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
    </SafeAreaView>
  );
}
