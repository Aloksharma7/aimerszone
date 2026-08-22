import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminBatchFormFields, useAdminBatchForm } from "@/components/admin/admin-batch-form";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdminBatch } from "@/lib/data/admin";

export default function NewAdminBatchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useAdminBatchForm(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => createAdminBatch(form.values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "batches"] });
      router.back();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The batch could not be saved."),
  });

  function submitForm() {
    const validation = form.validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    submit.mutate();
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <AdminBatchFormFields values={form.values} update={form.update} />

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submitForm}
            disabled={submit.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create batch</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
