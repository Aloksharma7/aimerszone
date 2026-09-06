import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAccountProfile, revokeOtherSessions } from "@/lib/data/account";
import type { AccountSession } from "@/types/lms";

export default function ActiveSessionsScreen() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["account", "profile"], queryFn: fetchAccountProfile });
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const revoke = useMutation({
    mutationFn: () => revokeOtherSessions(password),
    onSuccess: (result) => {
      setDone(result.revoked);
      setConfirming(false);
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not sign out other devices."),
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

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-5 py-6" bottomOffset={24}>
        <View className="gap-3">
          {profile.data.sessions.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
          {profile.data.sessions.length === 0 ? (
            <Text className="text-sm text-slate-500">No active browser sessions on your account right now.</Text>
          ) : null}
        </View>

        {done !== null ? (
          <View className="rounded-xl bg-success-100 p-3">
            <Text className="text-sm text-success-700">
              {done} other device{done === 1 ? "" : "s"} signed out.
            </Text>
          </View>
        ) : null}

        {confirming ? (
          <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Text className="text-sm text-slate-700">
              Enter your password to sign every other device out — this app included, if you&apos;re logged in elsewhere.
            </Text>
            <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} editable={!revoke.isPending} autoFocus />
            {error ? <Text className="text-sm text-danger-700">{error}</Text> : null}
            <Button
              label="Confirm sign-out"
              loading={revoke.isPending}
              disabled={password.length === 0}
              variant="danger"
              onPress={() => {
                setError(null);
                revoke.mutate();
              }}
            />
          </View>
        ) : (
          <Button
            label="Sign out other devices"
            variant="danger-outline"
            icon="log-out"
            onPress={() => {
              setDone(null);
              setConfirming(true);
            }}
          />
        )}
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}

function SessionRow({ session }: { session: AccountSession }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-xl bg-brand-100">
        <Feather name={session.platform === "iOS" || session.platform === "Android" ? "smartphone" : "monitor"} size={18} color="#1d4ed8" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">
          {session.browser} on {session.platform}
          {session.current ? " · This device" : ""}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">Last active {session.lastActiveAt}</Text>
      </View>
    </View>
  );
}
