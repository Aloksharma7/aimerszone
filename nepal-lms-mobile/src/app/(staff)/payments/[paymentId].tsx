import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { decidePayment, fetchPaymentDetail, fetchPaymentProofUrl } from "@/lib/data/staff";

const duplicateTone: Record<string, { bg: string; text: string }> = {
  duplicate: { bg: "bg-danger-100", text: "text-danger-700" },
  warning: { bg: "bg-warning-100", text: "text-warning-700" },
  clear: { bg: "bg-success-100", text: "text-success-700" },
};

export default function PaymentDetailScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const payment = useQuery({ queryKey: ["staff", "payment", paymentId], queryFn: () => fetchPaymentDetail(paymentId) });
  const [pendingAction, setPendingAction] = useState<"reject" | "flag" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const viewProof = useMutation({
    mutationFn: () => fetchPaymentProofUrl(paymentId),
    onSuccess: (destination) => Linking.openURL(destination.url),
  });

  const decide = useMutation({
    mutationFn: (input: { decision: "approve" | "reject" | "flag"; reason?: string }) => decidePayment(paymentId, input.decision, input.reason),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["staff", "payment", paymentId] });
      Alert.alert("Done", result.message, [{ text: "OK", onPress: () => router.back() }]);
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not record this decision."),
  });

  function confirmApprove() {
    Alert.alert("Approve this payment?", "This activates the student's enrollment and issues a receipt.", [
      { text: "Cancel", style: "cancel" },
      { text: "Approve", onPress: () => decide.mutate({ decision: "approve" }) },
    ]);
  }

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
        <Button label="Try again" onPress={() => payment.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = payment.data;
  const decidable = data.status === "submitted" || data.status === "under_review";
  const tone = duplicateTone[data.duplicateCheck.state] ?? duplicateTone.clear;

  return (
    <AppScreen edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-950">{data.studentName}</Text>
          {data.studentCode ? <Text className="text-xs text-slate-500">{data.studentCode}</Text> : null}
          {data.studentMobile ? <Text className="mt-1 text-xs text-slate-500">{data.studentMobile}</Text> : null}
          <Text className="mt-2 text-sm text-slate-700">
            {data.courseTitle} · {data.batchTitle}
          </Text>
          <Text className="mt-1 text-xs text-slate-500">{data.existingEnrollmentLabel}</Text>
        </View>

        <View className={`rounded-2xl p-4 ${tone.bg}`}>
          <Text className={`text-sm font-medium ${tone.text}`}>{data.duplicateCheck.message}</Text>
        </View>

        <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Row label="Expected" value={`Rs. ${data.expectedAmountNpr.toLocaleString("en-IN")}`} />
          <Row label="Paid" value={`Rs. ${data.submittedAmountNpr.toLocaleString("en-IN")}`} />
          <Row label="Method" value={data.paymentMethod} />
          <Row label="Reference" value={data.transactionReference || "Not provided"} />
          <Row label="Paid at" value={data.paidAt || "—"} />
          <Row label="Submitted" value={`${data.submittedAt}${data.submittedByName ? ` · ${data.submittedByName}` : ""}`} />
        </View>

        {data.proofAvailable ? (
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
        ) : (
          <Text className="text-center text-xs text-slate-400">No evidence file was attached.</Text>
        )}

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        {decidable ? (
          pendingAction ? (
            <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-sm font-semibold text-slate-700">
                {pendingAction === "reject" ? "Reason for rejection" : "Reason for flagging"} (shown to the student)
              </Text>
              <TextInput
                className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                value={reason}
                onChangeText={setReason}
                multiline
                textAlignVertical="top"
                editable={!decide.isPending}
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setPendingAction(null);
                    setReason("");
                  }}
                  className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100"
                >
                  <Text className="text-sm font-bold text-slate-700">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setError(null);
                    decide.mutate({ decision: pendingAction, reason });
                  }}
                  disabled={reason.trim().length < 5 || decide.isPending}
                  className="h-11 flex-1 flex-row items-center justify-center rounded-xl bg-danger-700 active:opacity-90 disabled:opacity-60"
                >
                  {decide.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Confirm</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="gap-3">
              <Pressable
                onPress={confirmApprove}
                disabled={decide.isPending}
                className="h-12 flex-row items-center justify-center rounded-xl bg-success-700 active:opacity-90 disabled:opacity-60"
              >
                <Text className="text-base font-bold text-white">Approve</Text>
              </Pressable>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setPendingAction("flag")}
                  disabled={decide.isPending}
                  className="h-12 flex-1 items-center justify-center rounded-xl border border-warning-700 active:bg-warning-100 disabled:opacity-60"
                >
                  <Text className="text-sm font-bold text-warning-700">Flag</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPendingAction("reject")}
                  disabled={decide.isPending}
                  className="h-12 flex-1 items-center justify-center rounded-xl border border-danger-700 active:bg-danger-100 disabled:opacity-60"
                >
                  <Text className="text-sm font-bold text-danger-700">Reject</Text>
                </Pressable>
              </View>
            </View>
          )
        ) : null}
      </ScrollView>
    </AppScreen>
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
