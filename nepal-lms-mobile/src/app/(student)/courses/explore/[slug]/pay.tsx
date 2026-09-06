import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { DateTimeField } from "@/components/date-time-field";
import { type CapturedProof, ProofCapture } from "@/components/proof-capture";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchPaymentOptions, submitStudentPayment } from "@/lib/data/catalogue";

export default function SubmitEnrollmentPaymentScreen() {
  const { batchId } = useLocalSearchParams<{ slug: string; batchId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const options = useQuery({ queryKey: ["student", "payment-options", batchId], queryFn: () => fetchPaymentOptions(batchId) });

  const [methodId, setMethodId] = useState<string | null>(null);
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date());
  const [proof, setProof] = useState<CapturedProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      submitStudentPayment({
        batchId,
        paymentMethodId: methodId!,
        amountNpr: options.data!.expectedAmountNpr,
        payerName,
        transactionReference: reference || undefined,
        paidAt: paidAt.toISOString(),
        proof: proof!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "payments"] });
      router.replace("/(student)/payments");
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not submit your payment."),
  });

  if (options.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (options.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">
          {isNormalizedApiError(options.error) ? options.error.message : "Something went wrong."}
        </Text>
      </SafeAreaView>
    );
  }

  const data = options.data;

  if (data.alreadyEnrolled || data.pendingReview) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">
          {data.alreadyEnrolled
            ? "You're already enrolled in this batch."
            : "You already have a payment for this batch under review — check the Payments tab."}
        </Text>
        <Button label="View payments" fullWidth={false} onPress={() => router.replace("/(student)/payments")} />
      </SafeAreaView>
    );
  }

  const canSubmit = Boolean(methodId && payerName.trim().length >= 2 && proof && !submit.isPending);

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-xs text-slate-500">
            {data.courseTitle} · {data.batchTitle}
          </Text>
          <Text className="mt-1 text-2xl font-bold text-slate-950">Rs. {data.expectedAmountNpr.toLocaleString("en-IN")}</Text>
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Payment method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipGroup options={data.methods.map((m) => ({ value: m.id, label: m.name }))} value={methodId} onChange={setMethodId} />
          </ScrollView>
          {methodId ? (
            <View className="mt-2 rounded-xl bg-slate-100 p-3">
              <Text className="text-xs text-slate-600">{data.methods.find((m) => m.id === methodId)?.accountName}</Text>
              <Text className="text-xs text-slate-600">{data.methods.find((m) => m.id === methodId)?.accountIdentifier}</Text>
            </View>
          ) : null}
        </View>

        <TextField label="Payer name" value={payerName} onChangeText={setPayerName} editable={!submit.isPending} />

        <TextField label="Transaction reference (optional)" value={reference} onChangeText={setReference} editable={!submit.isPending} />

        <DateTimeField label="When did you pay?" mode="date" value={paidAt} onChange={setPaidAt} maximumDate={new Date()} />

        <ProofCapture value={proof} onChange={setProof} />

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Button
          label="Submit payment"
          loading={submit.isPending}
          disabled={!canSubmit}
          size="lg"
          onPress={() => {
            setError(null);
            submit.mutate();
          }}
        />
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
