import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdminUser, type NewAdminUserInput } from "@/lib/data/admin";

const roles: { value: NewAdminUserInput["primaryRole"]; label: string; detail: string }[] = [
  { value: "teacher", label: "Teacher", detail: "Runs batches, classes, attendance and assessments." },
  { value: "staff", label: "Staff", detail: "Onboards students, manages the catalogue and reviews payments." },
  { value: "admin", label: "Admin", detail: "Day-to-day operations. Not settings, integrations or role management." },
  { value: "super_admin", label: "Super Admin", detail: "Full control including settings, roles and integrations. Only a Super Admin can grant this." },
  { value: "student", label: "Student", detail: "Learner account. Normally created by the enrollment office." },
];

export default function NewAdminUserScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [primaryRole, setPrimaryRole] = useState<NewAdminUserInput["primaryRole"]>("teacher");
  const [passwordSetupMethod, setPasswordSetupMethod] = useState<NewAdminUserInput["passwordSetupMethod"]>("link");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; staffCode: string | null; temporaryPassword: string | null } | null>(null);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const valid = name.trim().length >= 2 && emailValid;

  const submit = useMutation({
    mutationFn: () =>
      createAdminUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim() || undefined,
        primaryRole,
        passwordSetupMethod,
      }),
    onSuccess: (result) => setCreated(result),
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The account could not be created."),
  });

  if (created) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-2xl border border-success-200 bg-success-100 p-5">
            <Text className="text-lg font-bold text-success-700">Account created</Text>
            <Text className="mt-1 text-sm text-success-700">
              {created.staffCode ? `Staff code ${created.staffCode}. ` : ""}
              The account must change its password at first sign-in.
            </Text>

            {created.temporaryPassword ? (
              <View className="mt-4 rounded-xl border border-success-300 bg-white p-4">
                <Text className="text-xs font-bold uppercase tracking-wide text-slate-500">Temporary password — shown once</Text>
                <Text selectable className="mt-2 rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-sm text-white">
                  {created.temporaryPassword}
                </Text>
                <Text className="mt-2 text-xs text-slate-600">
                  This is not recoverable. Hand it over directly, and if it is lost, send a password reset instead. Long-press
                  the text above to copy it.
                </Text>
              </View>
            ) : (
              <View className="mt-4 rounded-xl border border-success-300 bg-white px-4 py-3">
                <Text className="text-sm text-slate-700">A password reset link has been emailed to {email.trim()}.</Text>
              </View>
            )}
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setCreated(null);
                setName("");
                setEmail("");
                setMobile("");
                setPrimaryRole("teacher");
                setPasswordSetupMethod("link");
              }}
              className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800"
            >
              <Text className="text-sm font-bold text-white">Create another</Text>
            </Pressable>
            <Pressable onPress={() => router.back()} className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100">
              <Text className="text-sm font-bold text-slate-700">Back to users</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const selectedRole = roles.find((role) => role.value === primaryRole);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Full name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Sita Sharma"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="sita@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Mobile (optional)</Text>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              placeholder="98XXXXXXXX"
              keyboardType="phone-pad"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Role</Text>
            <View className="gap-2">
              {roles.map((role) => {
                const selected = primaryRole === role.value;
                return (
                  <Pressable
                    key={role.value}
                    onPress={() => setPrimaryRole(role.value)}
                    className={`rounded-xl border p-3 ${selected ? "border-brand-700 bg-brand-50" : "border-slate-200 bg-white"}`}
                  >
                    <Text className={`text-sm font-semibold ${selected ? "text-brand-700" : "text-slate-900"}`}>{role.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedRole ? <Text className="text-xs text-slate-500">{selectedRole.detail}</Text> : null}
          </View>

          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">How should they set their password?</Text>
            <Pressable
              onPress={() => setPasswordSetupMethod("link")}
              className={`flex-row items-start gap-3 rounded-xl border p-3 ${passwordSetupMethod === "link" ? "border-brand-700 bg-brand-50" : "border-slate-200 bg-white"}`}
            >
              <Feather name={passwordSetupMethod === "link" ? "check-circle" : "circle"} size={18} color={passwordSetupMethod === "link" ? "#1d4ed8" : "#94a3b8"} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">Email a reset link</Text>
                <Text className="text-xs text-slate-500">Preferred. Nobody else ever sees the password.</Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setPasswordSetupMethod("temporary")}
              className={`flex-row items-start gap-3 rounded-xl border p-3 ${passwordSetupMethod === "temporary" ? "border-brand-700 bg-brand-50" : "border-slate-200 bg-white"}`}
            >
              <Feather
                name={passwordSetupMethod === "temporary" ? "check-circle" : "circle"}
                size={18}
                color={passwordSetupMethod === "temporary" ? "#1d4ed8" : "#94a3b8"}
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-slate-900">Show a temporary password once</Text>
                <Text className="text-xs text-slate-500">For handing over in person. Not recoverable afterwards.</Text>
              </View>
            </Pressable>
          </View>

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => {
              setError(null);
              submit.mutate();
            }}
            disabled={!valid || submit.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {submit.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color="#fff" />
                <Text className="text-base font-bold text-white">Create account</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
