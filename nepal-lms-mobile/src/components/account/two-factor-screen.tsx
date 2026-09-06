import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { confirmTwoFactorSetup, fetchAccountProfile, startTwoFactorSetup, type TwoFactorSetupStart } from "@/lib/data/account";

export default function TwoFactorScreen() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["account", "profile"], queryFn: fetchAccountProfile });
  const [setupState, setSetupState] = useState<TwoFactorSetupStart | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: startTwoFactorSetup,
    onSuccess: setSetupState,
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not start setup."),
  });

  const confirm = useMutation({
    mutationFn: () => confirmTwoFactorSetup(code),
    onSuccess: (result) => {
      setRecoveryCodes(result.recoveryCodes);
      setSetupState(null);
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "That code did not work."),
  });

  if (profile.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (profile.isError) {
    const message = isNormalizedApiError(profile.error) ? profile.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => profile.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (recoveryCodes) {
    return (
      <AppScreen edges={["bottom"]}>
        <ScrollView className="flex-1" contentContainerClassName="gap-4 px-6 py-6">
          <View className="items-center rounded-2xl bg-brand-900 p-6">
            <Feather name="check-circle" size={32} color="#ffffff" />
            <Text className="mt-2 text-lg font-bold text-white">Two-factor authentication is on</Text>
          </View>
          <Text className="text-sm text-slate-700">
            Save these recovery codes somewhere safe. Each one can be used once to sign in if you lose access to your authenticator app. They will not be
            shown again.
          </Text>
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            {recoveryCodes.map((item) => (
              <Text key={item} selectable className="py-1 font-mono text-sm text-slate-900">
                {item}
              </Text>
            ))}
          </View>
        </ScrollView>
      </AppScreen>
    );
  }

  if (profile.data.twoFactorEnabled) {
    return (
      <SafeAreaView className="flex-1 gap-4 bg-canvas px-6 py-6" edges={["bottom"]}>
        <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Feather name="shield" size={20} color="#15803d" />
          <Text className="flex-1 text-sm font-medium text-slate-900">Two-factor authentication is enabled on your account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (setupState) {
    return (
      <AppScreen edges={["bottom"]}>
        <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
          <Text className="text-sm text-slate-700">
            Add this key to your authenticator app (Google Authenticator, Authy, etc.), or tap below to open it directly if the app is installed.
          </Text>
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Text selectable className="text-center font-mono text-lg tracking-widest text-slate-900">
              {setupState.secret.match(/.{1,4}/g)?.join(" ")}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(setupState.otpauthUrl)}
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 active:bg-slate-100"
          >
            <Feather name="external-link" size={16} color="#1d4ed8" />
            <Text className="text-sm font-semibold text-brand-700">Open in authenticator app</Text>
          </Pressable>

          <View>
            <Text className="mb-1.5 text-sm font-semibold text-slate-700">Enter the 6-digit code</Text>
            <TextInput
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-center text-lg tracking-widest text-slate-900"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              editable={!confirm.isPending}
            />
          </View>

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setError(null);
              confirm.mutate();
            }}
            disabled={confirm.isPending || code.length !== 6}
            className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {confirm.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Confirm and enable</Text>}
          </Pressable>
        </KeyboardAwareScrollView>
      </AppScreen>
    );
  }

  return (
    <SafeAreaView className="flex-1 gap-4 bg-canvas px-6 py-6" edges={["bottom"]}>
      <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <Text className="text-sm text-slate-600">
          Two-factor authentication adds a one-time code from an authenticator app to your sign-in, on top of your password.
        </Text>
      </View>
      {error ? (
        <View className="rounded-xl bg-danger-100 p-3">
          <Text className="text-sm text-danger-700">{error}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          setError(null);
          start.mutate();
        }}
        disabled={start.isPending}
        className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
      >
        {start.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Set up two-factor authentication</Text>}
      </Pressable>
    </SafeAreaView>
  );
}
