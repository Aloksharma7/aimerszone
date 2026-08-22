import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PaymentPicker, SelectedPaymentCard } from "@/components/payment-picker";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createRefund } from "@/lib/data/staff";
import type { PaymentQueueItem } from "@/types/lms";

export default function NewRefundScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [payment, setPayment] = useState<PaymentQueueItem | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount);
  const valid = !!payment && Number.isFinite(amountValue) && amountValue > 0 && reason.trim().length >= 10;

  const submit = useMutation({
    mutationFn: () =>
      createRefund({
        paymentId: payment!.id,
        amountNpr: amountValue,
        reason: reason.trim(),
        method: method.trim() || undefined,
        reference: reference.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "refunds"] });
      Alert.alert("Refund request submitted", "Recording the payout itself is a separate step once the money has left the account.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not submit this refund."),
  });

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-xl bg-warning-100 p-3">
            <Text className="text-sm text-warning-700">The payment must be Approved and the refund cannot exceed what was actually paid.</Text>
          </View>

          {payment ? <SelectedPaymentCard payment={payment} onChange={() => setPayment(null)} /> : <PaymentPicker onSelect={setPayment} />}

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Refund amount (NPR)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Method (optional)</Text>
            <TextInput
              value={method}
              onChangeText={setMethod}
              placeholder="Bank transfer, eSewa, cash"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Reference (optional)</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Bank or wallet transaction reference"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              textAlignVertical="top"
              placeholder="Recorded in the audit log."
              className="h-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setError(null);
              submit.mutate();
            }}
            disabled={!valid || submit.isPending}
            className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Submit refund request</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
