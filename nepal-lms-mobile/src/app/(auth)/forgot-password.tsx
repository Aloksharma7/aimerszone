import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthHero } from "@/components/auth-hero";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { requestPasswordReset } from "@/lib/auth/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const message = await requestPasswordReset(identifier.trim());
      setNotice(message);
    } catch (err) {
      setError(isNormalizedApiError(err) ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <StatusBar style="light" />
      <AuthHero title="Aimers Zone" subtitle="We'll help you get back in." showBack />

      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="flex-grow px-6 pb-10"
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <View className="-mt-8 gap-5 rounded-3xl bg-white p-6 shadow-lg">
          <View>
            <Text className="text-xl font-bold text-slate-950">Reset your password</Text>
            <Text className="mt-1 text-sm leading-5 text-slate-500">
              Enter your phone number or email. If recovery is available, instructions will be sent.
            </Text>
          </View>

          {notice ? (
            <View className="gap-4">
              <View className="rounded-xl bg-success-100 p-4">
                <Text className="text-sm text-success-700">{notice}</Text>
              </View>
              <Pressable onPress={() => router.back()} className="h-12 items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800">
                <Text className="text-base font-bold text-white">Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <View>
                <Text className="mb-1.5 text-sm font-semibold text-slate-700">Phone number or email</Text>
                <View className="h-12 flex-row items-center rounded-xl border border-slate-200 bg-white px-3.5">
                  <Feather name="user" size={17} color="#94a3b8" style={{ marginRight: 8 }} />
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#94a3b8"
                    className="flex-1 text-base text-slate-900"
                    editable={!submitting}
                  />
                </View>
              </View>

              {error ? (
                <View className="rounded-xl bg-danger-100 p-3">
                  <Text className="text-sm text-danger-700">{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={submitting || identifier.trim().length < 3}
                className="mt-1 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Send recovery instructions</Text>}
              </Pressable>

              <Pressable onPress={() => router.back()} className="h-11 items-center justify-center">
                <Text className="text-sm font-semibold text-slate-600">Back to sign in</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
