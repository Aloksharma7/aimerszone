import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AppScreen } from "@/components/app-screen";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherBatches, postTeacherAnnouncement } from "@/lib/data/teacher";

const schema = z.object({
  batchId: z.string().min(1, "Choose a batch."),
  title: z.string().min(3, "Enter a subject.").max(180),
  body: z.string().min(10, "Add a bit more detail.").max(20000),
  pinned: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function NewAnnouncementScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const batches = useQuery({ queryKey: ["teacher", "batches"], queryFn: fetchTeacherBatches });
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { batchId: "", title: "", body: "", pinned: false } });

  const submit = useMutation({
    mutationFn: (values: FormValues) => postTeacherAnnouncement(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "announcements"] });
      router.back();
    },
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not post this announcement."),
  });

  if (batches.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (batches.isError) {
    const message = isNormalizedApiError(batches.error) ? batches.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => batches.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Batch</Text>
          <Controller
            control={control}
            name="batchId"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2">
                {batches.data.map((batch) => {
                  const selected = value === batch.id;
                  return (
                    <Pressable
                      key={batch.id}
                      onPress={() => onChange(batch.id)}
                      className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>
                        {batch.courseTitle} · {batch.batchTitle}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
          {errors.batchId ? <Text className="mt-1 text-sm text-danger-700">{errors.batchId.message}</Text> : null}
        </View>

        <FormField control={control} name="title" label="Subject" error={errors.title?.message} editable={!submit.isPending} />

        <FormField
          control={control}
          name="body"
          label="Message"
          error={errors.body?.message}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          style={{ height: 140, paddingTop: 12 }}
          editable={!submit.isPending}
        />

        <Controller
          control={control}
          name="pinned"
          render={({ field: { onChange, value } }) => (
            <Pressable onPress={() => onChange(!value)} className="flex-row items-center gap-3">
              <Feather name={value ? "check-square" : "square"} size={20} color={value ? "#1d4ed8" : "#94a3b8"} />
              <Text className="text-sm text-slate-700">Pin to the top of the batch&apos;s announcements</Text>
            </Pressable>
          )}
        />

        {serverError ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{serverError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit((values) => {
            setServerError(null);
            submit.mutate(values);
          })}
          disabled={isSubmitting || submit.isPending}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Post announcement</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
