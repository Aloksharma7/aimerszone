import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { type CapturedProof, ProofCapture } from "@/components/proof-capture";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchPaymentMethodOptions, fetchStaffCourseOptions, fetchStaffStudentDetail, submitStaffEnrollment } from "@/lib/data/staff";
import type { BatchOption, CourseOption, PaymentMethodOption } from "@/types/lms";

export default function EnrollStudentScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const student = useQuery({ queryKey: ["staff", "student", studentId], queryFn: () => fetchStaffStudentDetail(studentId) });
  const courses = useQuery({ queryKey: ["staff", "courses"], queryFn: fetchStaffCourseOptions });
  const methods = useQuery({ queryKey: ["payment-methods"], queryFn: fetchPaymentMethodOptions });

  const [courseId, setCourseId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState<CapturedProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCourse = courses.data?.find((course) => course.id === courseId) ?? null;

  const submit = useMutation({
    mutationFn: () =>
      submitStaffEnrollment({
        studentId,
        courseId: courseId!,
        batchId: batchId ?? undefined,
        paymentMethodId: methodId!,
        amountNpr: Number(amount),
        payerName,
        transactionReference: reference || undefined,
        paymentDate: new Date().toISOString(),
        internalNote: note || undefined,
        proof,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "students"] });
      router.replace("/(staff)/students");
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not submit this enrollment."),
  });

  if (student.isPending || courses.isPending || methods.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (student.isError || courses.isError || methods.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">Could not load the enrollment form. Try again.</Text>
      </SafeAreaView>
    );
  }

  const canSubmit = Boolean(courseId && methodId && amount.trim() !== "" && payerName.trim().length >= 2 && !submit.isPending);

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-xs text-slate-500">Enrolling</Text>
          <Text className="mt-0.5 text-base font-bold text-slate-950">{student.data.name}</Text>
        </View>

        <LabeledChipGroup
          label="Course"
          options={courses.data.map((course: CourseOption) => ({ value: course.id, label: course.title }))}
          value={courseId}
          onChange={(value) => {
            setCourseId(value);
            setBatchId(null);
          }}
        />

        {selectedCourse && selectedCourse.batches.length > 0 ? (
          <LabeledChipGroup
            label="Batch"
            options={selectedCourse.batches.map((batch: BatchOption) => ({ value: batch.id, label: batch.title }))}
            value={batchId}
            onChange={(value) => {
              setBatchId(value);
              const batch = selectedCourse.batches.find((item) => item.id === value);
              if (batch) setAmount(String(batch.priceNpr));
            }}
          />
        ) : null}

        <LabeledChipGroup
          label="Payment method"
          options={methods.data.map((method: PaymentMethodOption) => ({ value: method.id, label: method.name }))}
          value={methodId}
          onChange={setMethodId}
        />

        <View>
          <TextField label="Amount paid (Rs.)" value={amount} onChangeText={setAmount} keyboardType="number-pad" editable={!submit.isPending} />
          <Text className="mt-1 text-xs text-slate-400">0 records a full scholarship or fee waiver.</Text>
        </View>

        <TextField label="Payer name" value={payerName} onChangeText={setPayerName} editable={!submit.isPending} />

        <TextField label="Transaction reference (optional)" value={reference} onChangeText={setReference} editable={!submit.isPending} />

        <ProofCapture value={proof} onChange={setProof} />

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Internal note (optional)</Text>
          <TextInput
            className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
            editable={!submit.isPending}
          />
        </View>

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Button
          label="Submit enrollment"
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

function LabeledChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-slate-700">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChipGroup<string | null> options={options} value={value} onChange={(next) => next && onChange(next)} />
      </ScrollView>
    </View>
  );
}
