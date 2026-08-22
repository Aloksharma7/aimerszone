import { zodResolver } from "@hookform/resolvers/zod";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AuthHero } from "@/components/auth-hero";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { registerStudent } from "@/lib/auth/api";
import { preferredPortalHome } from "@/lib/auth/roles";
import { useSessionStore } from "@/lib/auth/session-store";

const schema = z
  .object({
    name: z.string().min(2, "Enter your full name."),
    mobile: z.string().min(7, "Enter a valid mobile number."),
    email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
    password: z.string().min(8, "At least 8 characters."),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

type FormValues = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const signIn = useSessionStore((state) => state.signIn);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recordingPolicyAcknowledged, setRecordingPolicyAcknowledged] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", mobile: "", email: "", password: "", passwordConfirmation: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await registerStudent({
        name: values.name,
        mobile: values.mobile,
        email: values.email || undefined,
        password: values.password,
        passwordConfirmation: values.passwordConfirmation,
        preferredLanguage: "en",
        recordingPolicyAcknowledged,
      });
      if (result.status === "requires_unsupported_action") {
        setServerError(result.message);
        return;
      }
      await signIn(result.token, result.user);
      router.replace(preferredPortalHome(result.user));
    } catch (error) {
      setServerError(isNormalizedApiError(error) ? error.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <StatusBar style="light" />
      <AuthHero title="Aimers Zone" subtitle="Create an account to start learning." showBack />

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-6 pb-10"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View className="-mt-8 gap-5 rounded-3xl bg-white p-6 shadow-lg">
          <View>
            <Text className="text-xl font-bold text-slate-950">Create your account</Text>
            <Text className="mt-1 text-sm leading-5 text-slate-500">Use a mobile number you can access. Email is optional.</Text>
          </View>

          <View className="gap-4">
            <FormField control={control} name="name" label="Full name" leadingIcon="user" error={errors.name?.message} autoComplete="name" editable={!submitting} />
            <FormField
              control={control}
              name="mobile"
              label="Mobile number"
              leadingIcon="phone"
              error={errors.mobile?.message}
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!submitting}
            />
            <FormField
              control={control}
              name="email"
              label="Email (optional)"
              leadingIcon="mail"
              error={errors.email?.message}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!submitting}
            />
            <FormField control={control} name="password" label="Password" leadingIcon="lock" error={errors.password?.message} secureTextEntry editable={!submitting} />
            <FormField
              control={control}
              name="passwordConfirmation"
              label="Confirm password"
              leadingIcon="lock"
              error={errors.passwordConfirmation?.message}
              secureTextEntry
              editable={!submitting}
            />

            <View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
              <Text className="flex-1 text-sm text-slate-700">I have read the Recording Policy</Text>
              <Switch value={recordingPolicyAcknowledged} onValueChange={setRecordingPolicyAcknowledged} />
            </View>
            <Text className="text-xs leading-5 text-slate-500">
              By creating an account you agree to the institution&apos;s Terms and Privacy Notice.
            </Text>

            {serverError ? (
              <View className="rounded-xl bg-danger-100 p-3">
                <Text className="text-sm text-danger-700">{serverError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={submitting}
              className="mt-1 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create account</Text>}
            </Pressable>
          </View>
        </View>

        <Pressable onPress={() => router.back()} className="mt-6 h-11 items-center justify-center">
          <Text className="text-sm font-semibold text-slate-600">
            Already have an account? <Text className="font-bold text-brand-700">Sign in</Text>
          </Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
