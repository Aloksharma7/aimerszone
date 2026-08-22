import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchStaffPaymentSubmissionDetail, fetchStaffPaymentSubmissionProofUrl, notifyStaffPaymentSubmission } from "@/lib/data/staff";
import type { Payment } from "@/types/lms";

const toneByStatus: Record<Payment["status"], "success" | "warning" | "danger" | "info" | "neutral"> = {
  Approved: "success",
  "Under review": "warning",
  Submitted: "info",
  Rejected: "danger",
  Refunded: "info",
  Draft: "neutral",
};

export default function StaffSubmissionDetailScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const payment = useQuery({ queryKey: ["staff", "submission", paymentId], queryFn: () => fetchStaffPaymentSubmissionDetail(paymentId) });

  const viewProof = useMutation({
    mutationFn: () => fetchStaffPaymentSubmissionProofUrl(paymentId),
    onSuccess: (destination) => Linking.openURL(destination.url),
  });

  const notify = useMutation({
    mutationFn: () => notifyStaffPaymentSubmission(paymentId),
    onSuccess: () => Alert.alert("Notification queued", "The student will be notified about this payment's status."),
    onError: (err) => Alert.alert("Could not send notification", isNormalizedApiError(err) ? err.message : "Something went wrong."),
  });

  if (payment.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (payment.isError) {
    const message = isNormalizedApiError(payment.error) ? payment.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => payment.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = payment.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-lg font-bold text-slate-950">{data.studentName}</Text>
            <StatusBadge label={data.status} tone={toneByStatus[data.status]} />
          </View>
          <Text className="mt-2 text-sm text-slate-700">
            {data.courseTitle} · {data.batchTitle}
          </Text>
          {data.riskLabel !== "Normal" ? (
            <View className="mt-2 self-start rounded-full bg-danger-100 px-2.5 py-1">
              <Text className="text-xs font-semibold text-danger-700">{data.riskLabel}</Text>
            </View>
          ) : null}
        </View>

        <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Row label="Amount" value={`Rs. ${data.amountNpr.toLocaleString("en-IN")}`} />
          <Row label="Method" value={data.method} />
          <Row label="Submitted" value={data.submittedAt} />
        </View>

        <Pressable
          onPress={() => viewProof.mutate()}
          disabled={viewProof.isPending}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 active:bg-slate-100"
        >
          {viewProof.isPending ? (
            <ActivityIndicator color="#1d4ed8" />
          ) : (
            <>
              <Feather name="image" size={16} color="#1d4ed8" />
              <Text className="text-sm font-bold text-brand-700">View payment evidence</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => notify.mutate()}
          disabled={notify.isPending}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {notify.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="bell" size={16} color="#fff" />
              <Text className="text-sm font-bold text-white">Resend status notification</Text>
            </>
          )}
        </Pressable>

        <View className="rounded-xl bg-info-100 p-3">
          <Text className="text-sm text-info-700">
            Approve, reject, refund and adjustment actions are intentionally absent here. Corrections require the audited Payment
            Review or Adjustments workflow.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xs text-slate-500">{label}</Text>
      <Text className="text-sm font-medium text-slate-900">{value}</Text>
    </View>
  );
}
