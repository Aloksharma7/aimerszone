import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { PaymentPicker, SelectedPaymentCard } from "@/components/payment-picker";
import { TextField } from "@/components/text-field";
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
    <AppScreen edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-xl bg-warning-100 p-3">
            <Text className="text-sm text-warning-700">The payment must be Approved and the refund cannot exceed what was actually paid.</Text>
          </View>

          {payment ? <SelectedPaymentCard payment={payment} onChange={() => setPayment(null)} /> : <PaymentPicker onSelect={setPayment} />}

          <TextField label="Refund amount (NPR)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />

          <TextField label="Method (optional)" value={method} onChangeText={setMethod} placeholder="Bank transfer, eSewa, cash" />

          <TextField label="Reference (optional)" value={reference} onChangeText={setReference} placeholder="Bank or wallet transaction reference" />

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

          <Button
            label="Submit refund request"
            loading={submit.isPending}
            disabled={!valid}
            size="lg"
            onPress={() => {
              setError(null);
              submit.mutate();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
