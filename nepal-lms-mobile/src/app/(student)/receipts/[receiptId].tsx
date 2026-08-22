import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { downloadReceipt, fetchReceipt } from "@/lib/data/student";

export default function ReceiptDetailScreen() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  const receipt = useQuery({ queryKey: ["student", "receipt", receiptId], queryFn: () => fetchReceipt(receiptId) });
  const download = useMutation({
    mutationFn: () => downloadReceipt(receiptId),
    onSuccess: (destination) => Linking.openURL(destination.url),
  });

  if (receipt.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (receipt.isError) {
    const message = isNormalizedApiError(receipt.error) ? receipt.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => receipt.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = receipt.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-6 px-5 py-6">
        <View className="items-center rounded-2xl bg-brand-900 p-6">
          <Feather name="check-circle" size={32} color="#ffffff" />
          <Text className="mt-3 text-xs font-bold uppercase tracking-wide text-brand-100">Payment receipt</Text>
          <Text className="mt-1 text-2xl font-bold text-white">Rs. {data.amountNpr.toLocaleString("en-IN")}</Text>
          <Text className="mt-1 text-sm text-brand-100">{data.issuedAt}</Text>
        </View>

        <View className="gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
          <DetailRow label="Reference" value={data.paymentReference} />
          <DetailRow label="Student" value={`${data.studentName}${data.studentCode ? ` (${data.studentCode})` : ""}`} />
          <DetailRow label="Course" value={data.courseTitle} />
          <DetailRow label="Batch" value={data.batchTitle} />
          <DetailRow label="Payment method" value={data.paymentMethod} />
        </View>

        <Pressable
          onPress={() => download.mutate()}
          disabled={download.isPending}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {download.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="download" size={18} color="#fff" />
              <Text className="text-sm font-bold text-white">Download PDF</Text>
            </>
          )}
        </Pressable>
        {download.isError ? (
          <Text className="text-center text-xs text-danger-700">
            {isNormalizedApiError(download.error) ? download.error.message : "Could not download the receipt."}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="mt-0.5 text-sm font-medium text-slate-900">{value}</Text>
    </View>
  );
}
