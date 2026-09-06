import { zodResolver } from "@hookform/resolvers/zod";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { AuthButton } from "@/components/auth-button";
import { AuthHero } from "@/components/auth-hero";
import { Checkbox } from "@/components/checkbox";
import { FormField } from "@/components/form-field";
import { PasswordStrength } from "@/components/password-strength";
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
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", mobile: "", email: "", password: "", passwordConfirmation: "" },
  });
  const password = watch("password");

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
      <AuthHero title="Aimers Zone" subtitle="Create an account to start learning." />

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center px-6 pb-10"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full md:max-w-[440px]">
          <Animated.View entering={FadeInUp.duration(380).delay(80)} className="-mt-4 gap-7 rounded-3xl bg-white p-6 shadow-xl shadow-brand-950/10">
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
              <View className="gap-2">
                <FormField control={control} name="password" label="Password" leadingIcon="lock" error={errors.password?.message} secureTextEntry editable={!submitting} />
                <PasswordStrength password={password} />
              </View>
              <FormField
                control={control}
                name="passwordConfirmation"
                label="Confirm password"
                leadingIcon="lock"
                error={errors.passwordConfirmation?.message}
                secureTextEntry
                editable={!submitting}
              />

              <Checkbox
                checked={recordingPolicyAcknowledged}
                onToggle={() => setRecordingPolicyAcknowledged((value) => !value)}
                label="I have read the Recording Policy"
              />
              <Text className="text-xs leading-5 text-slate-500">
                By creating an account you agree to the institution&apos;s Terms and Privacy Notice.
              </Text>

              {serverError ? (
                <Animated.View entering={FadeInUp.duration(220)} className="flex-row items-center gap-2 rounded-xl bg-danger-100 p-3">
                  <Text className="flex-1 text-sm text-danger-700">{serverError}</Text>
                </Animated.View>
              ) : null}

              <AuthButton label="Create account" loadingLabel="Creating account…" loading={submitting} onPress={handleSubmit(onSubmit)} />
            </View>
          </Animated.View>

          <Pressable onPress={() => router.back()} hitSlop={8} className="mt-6 h-11 items-center justify-center">
            <Text className="text-sm font-semibold text-slate-600">
              Already have an account? <Text className="font-bold text-brand-700">Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
