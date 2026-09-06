import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AppScreen } from "@/components/app-screen";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAccountProfile, updateAccountProfile } from "@/lib/data/account";

const schema = z.object({
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email.").or(z.literal("")),
  mobile: z.string().min(1, "Enter a mobile number.").or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["account", "profile"], queryFn: fetchAccountProfile });
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", mobile: "" } });

  useEffect(() => {
    if (profile.data) {
      reset({ name: profile.data.name, email: profile.data.email ?? "", mobile: profile.data.mobile ?? "" });
    }
  }, [profile.data, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) => updateAccountProfile({ name: values.name, email: values.email || null, mobile: values.mobile || null }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["account", "profile"], updated);
      router.back();
    },
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not save your changes."),
  });

  if (profile.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow gap-4 px-6 py-6"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <FormField control={control} name="name" label="Full name" error={errors.name?.message} editable={!save.isPending} />
        <FormField
          control={control}
          name="email"
          label="Email"
          error={errors.email?.message}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!save.isPending}
        />
        <FormField control={control} name="mobile" label="Mobile number" error={errors.mobile?.message} keyboardType="phone-pad" editable={!save.isPending} />

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
          {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Save changes</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
