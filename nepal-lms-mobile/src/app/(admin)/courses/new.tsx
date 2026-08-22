import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AdminCourseFormFields, useAdminCourseForm } from "@/components/admin/admin-course-form";
import { ProofCapture, type CapturedProof } from "@/components/proof-capture";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdminCourse, uploadAdminCourseThumbnail } from "@/lib/data/admin";

export default function NewAdminCourseScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useAdminCourseForm(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [thumbnail, setThumbnail] = useState<CapturedProof | null>(null);

  const submit = useMutation({
    mutationFn: (publish: boolean) => createAdminCourse({ ...form.values, published: publish }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      setCreated(result);
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The course could not be saved."),
  });

  const uploadThumbnail = useMutation({
    mutationFn: () => uploadAdminCourseThumbnail(created!.id, thumbnail!),
    onSuccess: () => router.replace({ pathname: "/(admin)/courses/[courseId]", params: { courseId: created!.id } }),
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The thumbnail could not be uploaded."),
  });

  function submitForm(publish: boolean) {
    const validation = form.validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    submit.mutate(publish);
  }

  if (created) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-2xl border border-success-200 bg-success-100 p-5">
            <Text className="text-lg font-bold text-success-700">Course created</Text>
            <Text className="mt-1 text-sm text-success-700">Add a thumbnail now, or skip and add one later from the course page.</Text>
          </View>

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <ProofCapture value={thumbnail} onChange={setThumbnail} label="Course thumbnail" />

          <View className="flex-row gap-3">
            {thumbnail ? (
              <Pressable
                onPress={() => uploadThumbnail.mutate()}
                disabled={uploadThumbnail.isPending}
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
              >
                {uploadThumbnail.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Upload and finish</Text>}
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.replace({ pathname: "/(admin)/courses/[courseId]", params: { courseId: created.id } })}
              className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100"
            >
              <Text className="text-sm font-bold text-slate-700">Skip for now</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <AdminCourseFormFields values={form.values} update={form.update} updateTitle={form.updateTitle} editing={false} />

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => submitForm(false)}
              disabled={submit.isPending}
              className="h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100 disabled:opacity-60"
            >
              <Text className="text-sm font-bold text-slate-700">Save as draft</Text>
            </Pressable>
            <Pressable
              onPress={() => submitForm(true)}
              disabled={submit.isPending}
              className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Save and publish</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
