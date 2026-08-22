import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdminBatchesPage } from "@/lib/data/admin";
import type { AdminBatch } from "@/types/lms";

const filters = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "ongoing", label: "Ongoing" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
];

const statusTone: Record<string, "success" | "info" | "neutral" | "danger"> = {
  open: "success",
  ongoing: "info",
  draft: "neutral",
  closed: "neutral",
  cancelled: "danger",
};

export default function AdminBatchesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const batches = useInfiniteQuery({
    queryKey: ["admin", "batches", debounced, status],
    queryFn: ({ pageParam }) => fetchAdminBatchesPage(pageParam, debounced || undefined, status),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = batches.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-950">Batches</Text>
          <Pressable
            onPress={() => router.push("/(admin)/batches/new")}
            className="h-10 flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New</Text>
          </Pressable>
        </View>

        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput className="flex-1 text-base text-slate-900" placeholder="Search batch, course or teacher" value={search} onChangeText={setSearch} autoCapitalize="none" />
        </View>

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

      {batches.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : batches.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(batches.error) ? batches.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => batches.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <BatchRow batch={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={batches.isRefetching && !batches.isFetchingNextPage}
          onRefresh={() => batches.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (batches.hasNextPage && !batches.isFetchingNextPage) batches.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No batches match this search.</Text>
            </View>
          }
          ListFooterComponent={batches.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </SafeAreaView>
  );
}

function BatchRow({ batch }: { batch: AdminBatch }) {
  const router = useRouter();
  const percent = batch.capacity ? Math.round((batch.studentsCount / batch.capacity) * 100) : 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(admin)/batches/[batchId]", params: { batchId: batch.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
            {batch.title}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {batch.courseTitle}
          </Text>
        </View>
        <StatusBadge label={batch.status} tone={statusTone[batch.status] ?? "neutral"} />
      </View>
      <Text className="mt-1.5 text-xs text-slate-500" numberOfLines={1}>
        {batch.teacherNames.join(", ") || "No teacher assigned"} · {batch.scheduleSummary || "No schedule set"}
      </Text>
      <View className="mt-2">
        <Text className="text-xs font-semibold text-slate-700">
          {batch.studentsCount}/{batch.capacity} students
        </Text>
        <ProgressBar percent={percent} />
      </View>
    </Pressable>
  );
}
