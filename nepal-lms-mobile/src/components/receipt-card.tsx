import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { Receipt } from "@/types/lms";

export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(student)/receipts/[receiptId]", params: { receiptId: receipt.id } })}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 active:bg-slate-50"
    >
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
        <Feather name="file-text" size={20} color="#1d4ed8" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
          {receipt.courseTitle}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {receipt.batchTitle} · {receipt.paymentReference}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-400">{receipt.issuedAt}</Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-bold text-slate-950">Rs. {receipt.amountNpr.toLocaleString("en-IN")}</Text>
        <Feather name="chevron-right" size={16} color="#94a3b8" />
      </View>
    </Pressable>
  );
}
