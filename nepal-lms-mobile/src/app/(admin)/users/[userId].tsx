import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { DangerZone } from "@/components/danger-zone";
import { EmptyState } from "@/components/empty-state";
import { MetricTile } from "@/components/metric-tile";
import { DetailSkeleton } from "@/components/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import {
  archiveAdminUser,
  fetchAdminUserDetail,
  performAdminUserAction,
  updateAdminUser,
  type AdminUserAction,
  type UpdateAdminUserInput,
} from "@/lib/data/admin";
import { confirmDestructive } from "@/lib/ui/confirm";

const roleOptions: { value: UpdateAdminUserInput["primaryRole"]; label: string }[] = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

export default function AdminUserDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const detail = useQuery({ queryKey: ["admin", "user", userId], queryFn: () => fetchAdminUserDetail(userId) });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<UpdateAdminUserInput["primaryRole"]>("student");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [profileNotice, setProfileNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  const [reason, setReason] = useState("");
  const [actionNotice, setActionNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<AdminUserAction | null>(null);

  if (detail.data && initializedFor !== detail.data.user.id) {
    setName(detail.data.user.name);
    setEmail(detail.data.user.email ?? "");
    setMobile(detail.data.user.mobile ?? "");
    setRole(detail.data.user.primaryRole as UpdateAdminUserInput["primaryRole"]);
    setInitializedFor(detail.data.user.id);
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "user", userId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const saveProfile = useMutation({
    mutationFn: () => updateAdminUser(userId, { name: name.trim(), email: email.trim() || null, mobile: mobile.trim() || null, primaryRole: role }),
    onSuccess: () => {
      setProfileNotice({ tone: "success", message: "Verified profile information was updated and audited." });
      refresh();
    },
    onError: (err) => setProfileNotice({ tone: "danger", message: isNormalizedApiError(err) ? err.message : "The request could not be completed." }),
  });

  const performAction = useMutation({
    mutationFn: (action: AdminUserAction) => performAdminUserAction(userId, action, reason.trim() || undefined),
    onMutate: (action) => setBusyAction(action),
    onSuccess: () => {
      setActionNotice({ tone: "success", message: "The server accepted the request and recorded the audit reason." });
      setReason("");
      refresh();
    },
    onError: (err) => setActionNotice({ tone: "danger", message: isNormalizedApiError(err) ? err.message : "The request could not be completed." }),
    onSettled: () => setBusyAction(null),
  });

  const archive = useMutation({
    mutationFn: () => archiveAdminUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      router.back();
    },
    onError: (err) => {
      Alert.alert("Account not archived", isNormalizedApiError(err) ? err.message : "The account could not be archived.");
    },
  });

  function runAction(action: AdminUserAction, requiresReason: boolean) {
    if (requiresReason && reason.trim().length < 5) {
      setActionNotice({ tone: "danger", message: "Enter a short operational reason for this audited action." });
      return;
    }
    setActionNotice(null);
    performAction.mutate(action);
  }

  function confirmAction(action: AdminUserAction, title: string, requiresReason: boolean) {
    confirmDestructive(title, "This is an audited action, recorded with the reason above.", "Confirm", () => runAction(action, requiresReason));
  }

  if (detail.isPending) {
    return (
      <AppScreen edges={["bottom"]}>
        <DetailSkeleton />
      </AppScreen>
    );
  }

  if (detail.isError) {
    const message = isNormalizedApiError(detail.error) ? detail.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <View className="mt-4">
          <Button label="Try again" onPress={() => detail.refetch()} fullWidth={false} />
        </View>
      </SafeAreaView>
    );
  }

  const data = detail.data;
  const isSuspended = data.user.status.toLowerCase().includes("suspend");

  return (
    <AppScreen edges={["bottom"]}>
      <FlatList
        data={data.enrollments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold text-slate-900">{item.courseTitle}</Text>
              <StatusBadge label={item.status} tone={item.status === "active" ? "success" : "neutral"} />
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">{item.batchTitle}</Text>
            <Text className="mt-0.5 text-xs text-slate-500">
              {item.basisLabel} · Access until {item.accessLabel}
            </Text>
          </View>
        )}
        contentContainerClassName="gap-3 px-5 py-6"
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-lg font-bold text-slate-950">{data.user.name}</Text>
                <StatusBadge label={data.user.status} tone={data.user.status === "active" ? "success" : "neutral"} />
              </View>
              <Text className="mt-1 text-xs text-slate-500">
                {data.user.primaryRole}
                {data.user.studentCode ? ` · ${data.user.studentCode}` : ""}
              </Text>
              {data.user.email ? <DetailRow icon="mail" value={data.user.email} /> : null}
              {data.user.mobile ? <DetailRow icon="phone" value={data.user.mobile} /> : null}
              <DetailRow icon="check-circle" value={data.user.emailVerified ? "Email verified" : "Email not verified"} />
              {data.user.mfaEnabled ? <DetailRow icon="shield" value="Two-factor authentication enabled" /> : null}
            </View>

            <View className="flex-row flex-wrap gap-3">
              <MetricTile label="Enrollments" value={data.metrics.activeEnrollments} />
              <MetricTile label="Payments" value={data.metrics.approvedPayments} />
              <MetricTile label="Progress %" value={data.metrics.learningProgressPercent} />
            </View>

            <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-base font-bold text-slate-950">Profile and role</Text>
              <Text className="text-xs text-slate-500">Edit verified information. Laravel rechecks protected role assignments.</Text>

              {profileNotice ? (
                <View className={`rounded-xl p-3 ${profileNotice.tone === "success" ? "bg-success-100" : "bg-danger-100"}`}>
                  <Text className={`text-sm ${profileNotice.tone === "success" ? "text-success-700" : "text-danger-700"}`}>{profileNotice.message}</Text>
                </View>
              ) : null}

              <TextField label="Full name" value={name} onChangeText={setName} />
              <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextField label="Mobile" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" />

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Primary role</Text>
                <ChipGroup options={roleOptions} value={role} onChange={setRole} />
              </View>

              <Button
                label="Save profile"
                loadingLabel="Saving…"
                loading={saveProfile.isPending}
                disabled={name.trim().length < 3}
                onPress={() => {
                  setProfileNotice(null);
                  saveProfile.mutate();
                }}
              />
            </View>

            <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-slate-950">Account controls</Text>
                <StatusBadge label={data.user.status} tone={data.user.status === "active" ? "success" : "neutral"} />
              </View>
              <Text className="text-xs text-slate-500">Sensitive actions require authorization, identity checks and immutable audit entries.</Text>

              {actionNotice ? (
                <View className={`rounded-xl p-3 ${actionNotice.tone === "success" ? "bg-success-100" : "bg-danger-100"}`}>
                  <Text className={`text-sm ${actionNotice.tone === "success" ? "text-success-700" : "text-danger-700"}`}>{actionNotice.message}</Text>
                </View>
              ) : null}

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Operational reason</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  textAlignVertical="top"
                  placeholder="Required for suspension, restoration and MFA reset"
                  className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                  placeholderTextColor="#94a3b8"
                  maxLength={500}
                />
              </View>

              <ActionTile
                icon="key"
                title="Send password reset"
                description="Sends a time-limited link to the verified email."
                busy={busyAction === "password-reset"}
                disabled={performAction.isPending}
                onPress={() => runAction("password-reset", false)}
              />
              <ActionTile
                icon="lock"
                title="Revoke active sessions"
                description="Ends existing browser and device sessions."
                busy={busyAction === "revoke-sessions"}
                disabled={performAction.isPending}
                onPress={() => runAction("revoke-sessions", false)}
              />
              <ActionTile
                icon="shield"
                title="Reset MFA enrollment"
                description="Requires identity verification and forced re-enrollment."
                busy={busyAction === "mfa-reset"}
                disabled={performAction.isPending}
                onPress={() => confirmAction("mfa-reset", "Reset MFA enrollment for this account?", true)}
              />
              {isSuspended ? (
                <ActionTile
                  icon="user-check"
                  title="Restore active access"
                  description="Enrollment expiry and role policies still apply."
                  busy={busyAction === "reactivate"}
                  disabled={performAction.isPending}
                  onPress={() => confirmAction("reactivate", "Restore active access for this account?", true)}
                />
              ) : (
                <ActionTile
                  icon="user-x"
                  title="Suspend account"
                  description="Blocks sign-in without deleting records."
                  tone="danger"
                  busy={busyAction === "suspend"}
                  disabled={performAction.isPending}
                  onPress={() => confirmAction("suspend", "Suspend this account?", true)}
                />
              )}

              <View className="rounded-xl border border-danger-200 bg-danger-100 p-3">
                <Text className="text-sm font-bold text-danger-700">Permanent deletion is intentionally unavailable</Text>
                <Text className="mt-1 text-xs text-danger-700">
                  Accounts linked to payments, attendance, attempts or audit history are never erased. The Archive control
                  removes the account from active lists while keeping that history intact.
                </Text>
              </View>
            </View>

            {data.activity.length > 0 ? (
              <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <Text className="text-base font-bold text-slate-950">Recent account activity</Text>
                <View className="gap-3">
                  {data.activity.map((entry) => (
                    <View key={entry.id} className="border-l-2 border-slate-200 pl-3">
                      <Text className="text-sm font-semibold text-slate-900">{entry.action}</Text>
                      {entry.detail ? <Text className="mt-0.5 text-xs text-slate-500">{entry.detail}</Text> : null}
                      <Text className="mt-0.5 text-xs text-slate-400">{entry.occurredAt}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <DangerZone
              title="Archive this account"
              description="The account is suspended and hidden from every list. Payment history, receipts and audit entries are kept intact."
            >
              <Button
                label="Archive account"
                loadingLabel="Archiving…"
                loading={archive.isPending}
                variant="danger"
                icon="archive"
                onPress={() =>
                  confirmDestructive(
                    "Archive this account?",
                    "The account is suspended and hidden from every list, but its history is kept intact.",
                    "Yes, archive it",
                    () => archive.mutate(),
                  )
                }
              />
            </DangerZone>

            {data.enrollments.length > 0 ? <Text className="text-sm font-bold text-slate-900">Enrollments</Text> : null}
          </View>
        }
        ListEmptyComponent={<EmptyState icon="book-open" title="No enrollments on record" description="This account hasn't joined any course batch yet." />}
      />
    </AppScreen>
  );
}

function ActionTile({
  icon,
  title,
  description,
  onPress,
  busy,
  disabled,
  tone = "outline",
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  tone?: "outline" | "danger";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-start gap-3 rounded-xl border p-3.5 disabled:opacity-60 ${
        tone === "danger" ? "border-danger-700 bg-danger-700 active:opacity-90" : "border-slate-300 bg-white active:bg-slate-50"
      }`}
    >
      {busy ? (
        <ActivityIndicator color={tone === "danger" ? "#fff" : "#1d4ed8"} />
      ) : (
        <Feather name={icon} size={18} color={tone === "danger" ? "#fff" : "#1d4ed8"} />
      )}
      <View className="flex-1">
        <Text className={`text-sm font-semibold ${tone === "danger" ? "text-white" : "text-slate-900"}`}>{title}</Text>
        <Text className={`mt-0.5 text-xs ${tone === "danger" ? "text-white/80" : "text-slate-500"}`}>{description}</Text>
      </View>
    </Pressable>
  );
}

function DetailRow({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  return (
    <View className="mt-2 flex-row items-center gap-2">
      <Feather name={icon} size={14} color="#64748b" />
      <Text className="text-sm text-slate-700">{value}</Text>
    </View>
  );
}
