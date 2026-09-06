import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { z } from "zod";

import { AppScreen } from "@/components/app-screen";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { changeAccountPassword } from "@/lib/data/account";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Use at least 8 characters, with letters and numbers."),
    passwordConfirmation: z.string().min(1, "Confirm your new password."),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", password: "", passwordConfirmation: "" },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      changeAccountPassword({ currentPassword: values.currentPassword, password: values.password, passwordConfirmation: values.passwordConfirmation }),
    onSuccess: () => router.back(),
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not change your password."),
  });

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-slate-500">Changing your password signs out every other device where you&apos;re logged in.</Text>

        <FormField
          control={control}
          name="currentPassword"
          label="Current password"
          error={errors.currentPassword?.message}
          secureTextEntry
          editable={!save.isPending}
        />
        <FormField control={control} name="password" label="New password" error={errors.password?.message} secureTextEntry editable={!save.isPending} />
        <FormField
          control={control}
          name="passwordConfirmation"
          label="Confirm new password"
          error={errors.passwordConfirmation?.message}
          secureTextEntry
          editable={!save.isPending}
        />

        {serverError ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{serverError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit((values) => {
            setServerError(null);
            save.mutate(values);
          })}
          disabled={isSubmitting || save.isPending}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Update password</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
