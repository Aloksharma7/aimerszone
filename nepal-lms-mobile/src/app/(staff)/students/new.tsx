import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createStaffStudent } from "@/lib/data/staff";

const schema = z.object({
  name: z.string().min(3, "Enter the student's full name."),
  mobile: z.string().min(7, "Enter a valid mobile number."),
  email: z.string().email("Enter a valid email.").or(z.literal("")),
  passwordSetupMethod: z.enum(["link", "temporary"]),
});

type FormValues = z.infer<typeof schema>;

export default function NewStudentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; studentCode: string | null; temporaryPassword: string | null } | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", mobile: "", email: "", passwordSetupMethod: "link" },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      createStaffStudent({ name: values.name, mobile: values.mobile, email: values.email || undefined, passwordSetupMethod: values.passwordSetupMethod }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "students"] });
      setCreated(result);
    },
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not create this student."),
  });

  if (created) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
        <View className="flex-1 gap-4 px-6 py-6">
          <View className="items-center rounded-2xl bg-brand-900 p-6">
            <Text className="text-lg font-bold text-white">Student created</Text>
            {created.studentCode ? <Text className="mt-1 text-sm text-brand-100">Code: {created.studentCode}</Text> : null}
          </View>
          {created.temporaryPassword ? (
            <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-xs text-slate-500">Temporary password — read this to the student now, it will not be shown again.</Text>
              <Text selectable className="mt-2 text-center font-mono text-lg text-slate-900">
                {created.temporaryPassword}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-slate-600">A password setup link was sent to the student&apos;s email.</Text>
          )}
          <Pressable
            onPress={() => router.replace({ pathname: "/(staff)/students/enroll", params: { studentId: created.id } })}
            className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Text className="text-base font-bold text-white">Enroll this student now</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="h-12 flex-row items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100">
            <Text className="text-base font-bold text-slate-700">Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <FormField control={control} name="name" label="Full name" error={errors.name?.message} editable={!create.isPending} />
        <FormField control={control} name="mobile" label="Mobile number" error={errors.mobile?.message} keyboardType="phone-pad" editable={!create.isPending} />
        <FormField
          control={control}
          name="email"
          label="Email (optional)"
          error={errors.email?.message}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!create.isPending}
        />

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Password setup</Text>
          <Controller
            control={control}
            name="passwordSetupMethod"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row gap-2">
                {(
                  [
                    { value: "link" as const, label: "Email reset link" },
                    { value: "temporary" as const, label: "Temporary password" },
                  ]
                ).map((option) => {
                  const selected = value === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => onChange(option.value)}
                      className={`flex-1 rounded-xl border px-3 py-3 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                    >
                      <Text className={`text-center text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        {serverError ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{serverError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit((values) => {
            setServerError(null);
            create.mutate(values);
          })}
          disabled={isSubmitting || create.isPending}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create student</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
