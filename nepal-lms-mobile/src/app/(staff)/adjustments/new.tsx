import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { PaymentPicker, SelectedPaymentCard } from "@/components/payment-picker";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdjustment, type NewAdjustmentInput } from "@/lib/data/staff";
import type { PaymentQueueItem } from "@/types/lms";

const typeOptions: { value: NewAdjustmentInput["type"]; label: string }[] = [
  { value: "credit", label: "Credit" },
  { value: "debit", label: "Debit" },
  { value: "reversal", label: "Reversal" },
  { value: "refund", label: "Refund" },
];

export default function NewAdjustmentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [payment, setPayment] = useState<PaymentQueueItem | null>(null);
  const [type, setType] = useState<NewAdjustmentInput["type"]>("credit");
  const [amount, setAmount] = useState("");
  const [authorizationReference, setAuthorizationReference] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amountValue = Number(amount);
  const valid = !!payment && Number.isFinite(amountValue) && amountValue > 0 && reason.trim().length >= 10 && authorizationReference.trim().length >= 3;

  const submit = useMutation({
    mutationFn: () =>
      createAdjustment({
        paymentId: payment!.id,
        type,
        amountNpr: amountValue,
        reason: reason.trim(),
        authorizationReference: authorizationReference.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "adjustments"] });
      Alert.alert("Adjustment recorded", "The financial correction has been saved.", [{ text: "OK", onPress: () => router.back() }]);
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not record this adjustment."),
  });

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          {payment ? <SelectedPaymentCard payment={payment} onChange={() => setPayment(null)} /> : <PaymentPicker onSelect={setPayment} />}

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Adjustment type</Text>
            <ChipGroup options={typeOptions} value={type} onChange={setType} />
          </View>

          <TextField label="Amount (NPR)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />

          <TextField
            label="Authorization reference"
            value={authorizationReference}
            onChangeText={setAuthorizationReference}
            placeholder="Approval ticket, policy reference or manager authorization"
          />

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Permanent reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              multiline
              textAlignVertical="top"
              className="h-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
            />
          </View>

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Button
            label="Submit adjustment"
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
