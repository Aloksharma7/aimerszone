import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { StatusBadge } from "@/components/status-badge";
import { searchPaymentsForPicker } from "@/lib/data/staff";
import type { PaymentQueueItem } from "@/types/lms";

const statusTone = { Approved: "success", "Under review": "warning", Submitted: "info", Rejected: "danger", Refunded: "neutral", Draft: "neutral" } as const;

export function PaymentPicker({ onSelect }: { onSelect: (payment: PaymentQueueItem) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaymentQueueItem[]>([]);
  const [searching, setSearching] = useState(false);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const items = await searchPaymentsForPicker(trimmedQuery);
        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-slate-700">Find the payment</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by student name or mobile"
        autoCapitalize="none"
        className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900"
        placeholderTextColor="#94a3b8"
      />
      {searching ? <ActivityIndicator color="#1d4ed8" /> : null}
      {visibleResults.length > 0 ? (
        <View className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {visibleResults.map((payment) => (
            <Pressable
              key={payment.id}
              onPress={() => {
                onSelect(payment);
                setQuery("");
                setResults([]);
              }}
              className="flex-row items-center justify-between gap-3 p-3 active:bg-slate-50"
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
                  {payment.studentName}
                </Text>
                <Text className="text-xs text-slate-500" numberOfLines={1}>
                  {payment.courseTitle} · {payment.id}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-sm font-semibold text-slate-900">Rs. {payment.amountNpr.toLocaleString("en-IN")}</Text>
                <StatusBadge label={payment.status} tone={statusTone[payment.status] ?? "neutral"} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!searching && trimmedQuery.length >= 2 && visibleResults.length === 0 ? (
        <Text className="text-xs text-slate-500">No matching payment. Try the student&apos;s full name or mobile number.</Text>
      ) : null}
    </View>
  );
}

export function SelectedPaymentCard({ payment, onChange }: { payment: PaymentQueueItem; onChange: () => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
      <View className="flex-1">
        <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected payment</Text>
        <Text className="mt-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {payment.studentName} · {payment.courseTitle}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {payment.id} · Rs. {payment.amountNpr.toLocaleString("en-IN")}
        </Text>
      </View>
      <Pressable onPress={onChange} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 active:bg-slate-100">
        <Text className="text-xs font-semibold text-slate-700">Change</Text>
      </Pressable>
    </View>
  );
}
