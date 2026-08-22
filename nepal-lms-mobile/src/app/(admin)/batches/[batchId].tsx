import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminBatchFormFields, useAdminBatchForm } from "@/components/admin/admin-batch-form";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { archiveAdminBatch, fetchAdminBatchDetail, updateAdminBatch } from "@/lib/data/admin";

export default function AdminBatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const detail = useQuery({ queryKey: ["admin", "batch", batchId], queryFn: () => fetchAdminBatchDetail(batchId) });
  const form = useAdminBatchForm(detail.data);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  if (detail.data && initializedFor !== detail.data.id) {
    form.hydrate(detail.data);
    setInitializedFor(detail.data.id);
  }

  const save = useMutation({
    mutationFn: () => updateAdminBatch(batchId, form.values),
    onSuccess: () => {
      setNotice("Batch saved.");
      queryClient.invalidateQueries({ queryKey: ["admin", "batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "batches"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The batch could not be saved."),
  });

  const archive = useMutation({
    mutationFn: () => archiveAdminBatch(batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "batches"] });
      router.back();
    },
    onError: (err) => {
      setConfirmingArchive(false);
      setArchiveError(isNormalizedApiError(err) ? err.message : "The batch could not be archived.");
    },
  });

  function submit() {
    const validation = form.validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setNotice(null);
    save.mutate();
  }

  if (detail.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (detail.isError) {
    const message = isNormalizedApiError(detail.error) ? detail.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => detail.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="flex-row items-center justify-between">
            <StatusBadge label={form.values.status} tone="info" />
            <Text className="text-xs text-slate-500">
              {detail.data.studentsCount}/{detail.data.capacity} students
            </Text>
          </View>

          <AdminBatchFormFields values={form.values} update={form.update} />

          {notice ? (
            <View className="rounded-xl bg-success-100 p-3">
              <Text className="text-sm text-success-700">{notice}</Text>
            </View>
          ) : null}
          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={save.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Save changes</Text>}
          </Pressable>

          <View className="gap-3 rounded-2xl border border-danger-200 bg-white p-4 shadow-sm">
            <Text className="text-base font-bold text-slate-950">Archive this batch</Text>
            <Text className="text-sm text-slate-600">
              It disappears from the catalogue and from every list, and no new enrolment can reference it. Existing payment
              records, receipts and attendance history are kept intact.
            </Text>
            {archiveError ? (
              <View className="rounded-xl bg-danger-100 p-3">
                <Text className="text-sm text-danger-700">{archiveError}</Text>
              </View>
            ) : null}
            {confirmingArchive ? (
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => archive.mutate()}
                  disabled={archive.isPending}
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-danger-700 active:opacity-90 disabled:opacity-60"
                >
                  {archive.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Yes, archive it</Text>}
                </Pressable>
                <Pressable
                  onPress={() => setConfirmingArchive(false)}
                  disabled={archive.isPending}
                  className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100"
                >
                  <Text className="text-sm font-bold text-slate-700">Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  setArchiveError(null);
                  setConfirmingArchive(true);
                }}
                className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-danger-300 active:bg-danger-100"
              >
                <Feather name="archive" size={16} color="#b91c1c" />
                <Text className="text-sm font-bold text-danger-700">Archive batch</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
