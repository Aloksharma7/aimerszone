import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAuditLogPage } from "@/lib/data/admin";
import type { AuditLogEntry } from "@/types/lms";

const groups = [
  { value: undefined, label: "All" },
  { value: "identity_access", label: "Identity & access" },
  { value: "payments", label: "Payments" },
  { value: "learning_operations", label: "Learning ops" },
  { value: "settings", label: "Settings" },
];

export default function AdminAuditLogScreen() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [group, setGroup] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const entries = useInfiniteQuery({
    queryKey: ["admin", "audit-log", debounced, group],
    queryFn: ({ pageParam }) => fetchAuditLogPage(pageParam, debounced || undefined, group),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = entries.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Audit log</Text>

        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 text-base text-slate-900"
            placeholder="Search action, actor or target"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {groups.map((option) => {
              const selected = group === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setGroup(option.value)}
                  className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                >
                  <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {entries.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : entries.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(entries.error) ? entries.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => entries.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <EntryRow entry={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={entries.isRefetching && !entries.isFetchingNextPage}
          onRefresh={() => entries.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (entries.hasNextPage && !entries.isFetchingNextPage) entries.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No matching audit entries.</Text>
            </View>
          }
          ListFooterComponent={entries.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </SafeAreaView>
  );
}

function EntryRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <Text className="text-sm font-semibold text-slate-900">{entry.action}</Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        {entry.actorLabel} · {entry.targetLabel}
      </Text>
      {entry.reason ? <Text className="mt-1.5 text-xs text-slate-600">{entry.reason}</Text> : null}
      <Text className="mt-1.5 text-xs text-slate-400">{entry.occurredAt}</Text>
    </View>
  );
}
