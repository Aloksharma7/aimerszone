import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { z } from "zod";

import { AppScreen } from "@/components/app-screen";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { submitSupportTicket } from "@/lib/data/student";

const categories = [
  { value: "course_access", label: "Course access" },
  { value: "payment", label: "Payment" },
  { value: "account", label: "Account" },
  { value: "class_recording", label: "Class or recording" },
  { value: "test", label: "Test" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  category: z.string().min(1, "Select an issue type."),
  subject: z.string().min(5, "Briefly describe the problem.").max(160),
  message: z.string().min(10, "Add a bit more detail.").max(3000),
});

type FormValues = z.infer<typeof schema>;

export default function NewSupportRequestScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { category: "course_access", subject: "", message: "" } });

  const submit = useMutation({
    mutationFn: (values: FormValues) => submitSupportTicket(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "support"] });
      router.back();
    },
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not submit your request."),
  });

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Issue type</Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row flex-wrap gap-2">
                {categories.map((option) => {
                  const selected = value === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => onChange(option.value)}
                      className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <FormField control={control} name="subject" label="Subject" error={errors.subject?.message} editable={!submit.isPending} />

        <FormField
          control={control}
          name="message"
          label="Message"
          error={errors.message?.message}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={{ height: 120, paddingTop: 12 }}
          editable={!submit.isPending}
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
          {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Submit request</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
