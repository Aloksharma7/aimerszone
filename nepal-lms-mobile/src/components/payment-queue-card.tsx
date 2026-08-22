import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { StatusBadge } from "@/components/status-badge";
import type { Payment, PaymentQueueItem } from "@/types/lms";

const toneByStatus: Record<Payment["status"], "success" | "warning" | "danger" | "info" | "neutral"> = {
  Approved: "success",
  "Under review": "warning",
  Submitted: "info",
  Rejected: "danger",
  Refunded: "info",
  Draft: "neutral",
};

export function PaymentQueueCard({ payment, basePath = "/(staff)/payments" }: { payment: PaymentQueueItem; basePath?: "/(staff)/payments" | "/(staff)/submissions" }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: `${basePath}/[paymentId]` as const, params: { paymentId: payment.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {payment.studentName}
        </Text>
        <StatusBadge label={payment.status} tone={toneByStatus[payment.status]} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
        {payment.courseTitle} · {payment.batchTitle}
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-base font-bold text-slate-950">Rs. {payment.amountNpr.toLocaleString("en-IN")}</Text>
        <Text className="text-xs text-slate-400">{payment.submittedAt}</Text>
      </View>
      {payment.riskLabel !== "Normal" ? (
        <View className="mt-2 self-start rounded-full bg-danger-100 px-2.5 py-1">
          <Text className="text-xs font-semibold text-danger-700">{payment.riskLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
