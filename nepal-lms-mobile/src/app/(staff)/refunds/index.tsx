import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { MetricTile } from "@/components/metric-tile";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { completeRefund, fetchRefunds } from "@/lib/data/staff";
import type { Refund } from "@/types/lms";

const filters = [
  { value: undefined, label: "All" },
  { value: "requested", label: "Requested" },
  { value: "processed", label: "Processed" },
];

export default function StaffRefundsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refunds = useQuery({ queryKey: ["staff", "refunds"], queryFn: fetchRefunds });

  const complete = useMutation({
    mutationFn: (input: { refundId: string; reference: string }) => completeRefund(input.refundId, input.reference),
    onSuccess: () => {
      setError(null);
      setCompletingId(null);
      setReference("");
      queryClient.invalidateQueries({ queryKey: ["staff", "refunds"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not record this payout."),
  });

  const items = (refunds.data?.items ?? []).filter((item) => !status || item.status === status);

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-950">Refunds</Text>
          <Pressable
            onPress={() => router.push("/(staff)/refunds/new")}
            className="h-10 flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New</Text>
          </Pressable>
        </View>

        {refunds.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-3">
              <MetricTile label="Pending" value={refunds.data.metrics.pending} />
              <MetricTile label="Completed (mo)" value={refunds.data.metrics.completedMonth} />
              <MetricTile label="Refunded (mo)" value={`Rs. ${refunds.data.metrics.completedAmountNpr.toLocaleString("en-IN")}`} />
              <MetricTile label="Exceptions" value={refunds.data.metrics.exceptions} />
            </View>
          </ScrollView>
        ) : null}

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

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}
      </View>

      {refunds.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : refunds.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(refunds.error) ? refunds.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => refunds.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RefundRow
              refund={item}
              expanded={completingId === item.id}
              reference={reference}
              onReferenceChange={setReference}
              onStartComplete={() => {
                setError(null);
                setCompletingId(item.id);
                setReference("");
              }}
              onCancelComplete={() => setCompletingId(null)}
              onConfirmComplete={() => {
                if (reference.trim().length < 3) {
                  setError("Enter a reference of at least 3 characters.");
                  return;
                }
                complete.mutate({ refundId: item.id, reference: reference.trim() });
              }}
              completing={complete.isPending && completingId === item.id}
            />
          )}
          contentContainerClassName="gap-3 px-5 py-4"
          refreshing={refunds.isRefetching}
          onRefresh={() => refunds.refetch()}
          ListEmptyComponent={
            <EmptyState icon="rotate-ccw" title="No refunds here" description="Refunds matching this filter will show up here." />
          }
        />
      )}
    </AppScreen>
  );
}

const statusTone = { requested: "warning", processed: "success" } as const;

function RefundRow({
  refund,
  expanded,
  reference,
  onReferenceChange,
  onStartComplete,
  onCancelComplete,
  onConfirmComplete,
  completing,
}: {
  refund: Refund;
  expanded: boolean;
  reference: string;
  onReferenceChange: (value: string) => void;
  onStartComplete: () => void;
  onCancelComplete: () => void;
  onConfirmComplete: () => void;
  completing: boolean;
}) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {refund.studentName}
        </Text>
        <StatusBadge label={refund.status} tone={statusTone[refund.status as keyof typeof statusTone] ?? "neutral"} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
        {refund.paymentId} · Rs. {refund.amountNpr.toLocaleString("en-IN")}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-600" numberOfLines={2}>
        {refund.reason}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-400">{refund.requestedAt}</Text>

      {refund.status === "requested" ? (
        expanded ? (
          <View className="mt-3 gap-2">
            <Text className="text-xs text-slate-500">
              Enter the bank or wallet reference. Whoever requested this refund cannot be the one to complete it.
            </Text>
            <TextInput
              value={reference}
              onChangeText={onReferenceChange}
              placeholder="Payout reference"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
              placeholderTextColor="#94a3b8"
              editable={!completing}
            />
            <View className="flex-row gap-2">
              <Pressable onPress={onCancelComplete} className="h-10 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100">
                <Text className="text-sm font-bold text-slate-700">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onConfirmComplete}
                disabled={completing}
                className="h-10 flex-1 flex-row items-center justify-center rounded-xl bg-success-700 active:opacity-90 disabled:opacity-60"
              >
                {completing ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Record payout</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onStartComplete}
            className="mt-3 h-10 flex-row items-center justify-center rounded-xl border border-success-700 active:bg-success-100"
          >
            <Text className="text-sm font-bold text-success-700">Mark as paid</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}
