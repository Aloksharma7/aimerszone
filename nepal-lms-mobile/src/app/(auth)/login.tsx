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
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { loginWithPassword } from "@/lib/auth/api";
import { preferredPortalHome } from "@/lib/auth/roles";
import { useSessionStore } from "@/lib/auth/session-store";

const schema = z.object({
  identifier: z.string().min(3, "Enter your email or mobile number."),
  password: z.string().min(1, "Enter your password."),
});

type FormValues = z.infer<typeof schema>;

/**
 * Wired to the real API client already — see docs/ROADMAP.md Phase 1. It
 * will fail with a 404 until the backend's mobile token-login endpoint
 * exists, since Sanctum's current cookie-session guard cannot authenticate
 * a native app. That is expected, not a bug in this screen.
 */
export default function LoginScreen() {
  const router = useRouter();
  const signIn = useSessionStore((state) => state.signIn);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "" } });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const result = await loginWithPassword(values.identifier, values.password);
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
      <AuthHero title="Aimers Zone" subtitle="Sign in to continue learning." />

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow items-center px-6 pb-10"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full md:max-w-[440px]">
          <Animated.View entering={FadeInUp.duration(380).delay(80)} className="-mt-4 gap-7 rounded-3xl bg-white p-6 shadow-xl shadow-brand-950/10">
            <Text className="text-xl font-bold text-slate-950">Welcome back</Text>

            <View className="gap-4">
              <FormField
                control={control}
                name="identifier"
                label="Email or mobile"
                leadingIcon="user"
                error={errors.identifier?.message}
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="email-address"
                editable={!submitting}
              />

              <View>
                <FormField
                  control={control}
                  name="password"
                  label="Password"
                  leadingIcon="lock"
                  error={errors.password?.message}
                  secureTextEntry
                  autoComplete="password"
                  editable={!submitting}
                />
                <Pressable onPress={() => router.push("/(auth)/forgot-password")} hitSlop={8} className="mt-2 self-end">
                  <Text className="text-sm font-semibold text-brand-700">Forgot password?</Text>
                </Pressable>
              </View>

              {serverError ? (
                <Animated.View entering={FadeInUp.duration(220)} className="flex-row items-center gap-2 rounded-xl bg-danger-100 p-3">
                  <Text className="flex-1 text-sm text-danger-700">{serverError}</Text>
                </Animated.View>
              ) : null}

              <AuthButton label="Sign in" loadingLabel="Signing in…" loading={submitting} onPress={handleSubmit(onSubmit)} />
            </View>
          </Animated.View>

          <Pressable onPress={() => router.push("/(auth)/register")} hitSlop={8} className="mt-6 h-11 items-center justify-center">
            <Text className="text-sm font-semibold text-slate-600">
              New student? <Text className="font-bold text-brand-700">Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
