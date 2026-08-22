import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { StatusBadge } from "@/components/status-badge";
import type { Payment } from "@/types/lms";

const toneByStatus: Record<Payment["status"], "success" | "warning" | "danger" | "info" | "neutral"> = {
  Approved: "success",
  "Under review": "warning",
  Submitted: "info",
  Rejected: "danger",
  Refunded: "info",
  Draft: "neutral",
};

export function PaymentCard({ payment }: { payment: Payment }) {
  const router = useRouter();
  const receiptId = payment.receiptId;

  return (
    <Pressable
      onPress={receiptId ? () => router.push({ pathname: "/(student)/receipts/[receiptId]", params: { receiptId } }) : undefined}
      className={`rounded-2xl border border-slate-100 bg-white shadow-sm p-4 ${receiptId ? "active:bg-slate-50" : ""}`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
            {payment.courseTitle}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {payment.batchTitle}
          </Text>
        </View>
        <StatusBadge label={payment.status} tone={toneByStatus[payment.status]} />
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-base font-bold text-slate-950">Rs. {payment.amountNpr.toLocaleString("en-IN")}</Text>
        <Text className="text-xs text-slate-400">{payment.submittedAt}</Text>
      </View>

      <Text className="mt-1 text-xs text-slate-500">
        {payment.method} · Ref: {payment.reference}
      </Text>

      {payment.status === "Rejected" && payment.rejectionReason ? (
        <Text className="mt-2 text-xs text-danger-700">{payment.rejectionReason}</Text>
      ) : null}

      {receiptId ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <Feather name="file-text" size={12} color="#1d4ed8" />
          <Text className="text-xs font-medium text-brand-700">View receipt</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
