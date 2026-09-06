import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { MetricTile } from "@/components/metric-tile";
import { SupportTicketCard } from "@/components/support-ticket-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchSupportTickets } from "@/lib/data/staff";

const filters = [
  { value: undefined, label: "All" },
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function StaffSupportScreen() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const tickets = useQuery({
    queryKey: ["staff", "support", status, debouncedSearch],
    queryFn: () => fetchSupportTickets(status, debouncedSearch || undefined),
  });

  const items = tickets.data?.items ?? [];

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Support tickets</Text>

        {tickets.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              <MetricTile label="Open" value={tickets.data.metrics.open} />
              <MetricTile label="Pending" value={tickets.data.metrics.pending} />
              <MetricTile label="Resolved (mo)" value={tickets.data.metrics.resolvedMonth} />
              <MetricTile label="Waiting 2d+" value={tickets.data.metrics.waitingOver2Days} />
            </View>
          </ScrollView>
        ) : null}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by reference, subject, student"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
          placeholderTextColor="#94a3b8"
        />

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

      {tickets.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : tickets.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(tickets.error) ? tickets.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => tickets.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <SupportTicketCard ticket={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={tickets.isRefetching}
          onRefresh={() => tickets.refetch()}
          ListEmptyComponent={
            <View className="mx-5">
              <EmptyState icon="life-buoy" title="No tickets here" description="Support requests matching this filter will show up here." />
            </View>
          }
        />
      )}
    </AppScreen>
  );
}
