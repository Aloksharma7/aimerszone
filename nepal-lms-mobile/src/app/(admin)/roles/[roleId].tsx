import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { AdminRoleFormFields, useAdminRoleForm } from "@/components/admin/admin-role-form";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { deleteAdminRole, fetchAdminRoles, updateAdminRole } from "@/lib/data/admin";

export default function AdminRoleDetailScreen() {
  const { roleId } = useLocalSearchParams<{ roleId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: fetchAdminRoles });
  const role = roles.data?.find((item) => item.id === roleId) ?? null;

  const form = useAdminRoleForm(role);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (role && initializedFor !== role.id) {
    form.hydrate(role);
    setInitializedFor(role.id);
  }

  const save = useMutation({
    mutationFn: () => updateAdminRole(roleId, form.values),
    onSuccess: () => {
      setNotice("Role saved.");
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The role could not be saved."),
  });

  const remove = useMutation({
    mutationFn: () => deleteAdminRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "roles"] });
      router.back();
    },
    onError: (err) => {
      setConfirmingDelete(false);
      setDeleteError(isNormalizedApiError(err) ? err.message : "The role could not be deleted.");
    },
  });

  function submit() {
    const validation = form.validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setNotice(null);
    save.mutate();
  }

  if (roles.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (!role) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">Role not found.</Text>
      </SafeAreaView>
    );
  }

  if (role.key === "super_admin") {
    return (
      <AppScreen edges={["bottom"]}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Text className="text-lg font-bold text-slate-950">{role.name}</Text>
            <Text className="mt-1 text-xs text-slate-500">{role.usersCount} user{role.usersCount === 1 ? "" : "s"}</Text>
          </View>
          <View className="rounded-xl bg-info-100 p-3">
            <Text className="text-sm text-info-700">
              The super admin role always holds every permission and cannot be edited or deleted.
            </Text>
          </View>
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <Text className="text-xs text-slate-500">
            {role.usersCount} user{role.usersCount === 1 ? "" : "s"} currently hold this role.
          </Text>

          <AdminRoleFormFields values={form.values} update={form.update} togglePermission={form.togglePermission} />

          {notice ? (
            <View className="rounded-xl bg-success-100 p-3">
              <Text className="text-sm text-success-700">{notice}</Text>
            </View>
          ) : null}
          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={save.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Save changes</Text>}
          </Pressable>

          {!role.protected ? (
            <View className="gap-3 rounded-2xl border border-danger-200 bg-white p-4 shadow-sm">
              <Text className="text-base font-bold text-slate-950">Delete this role</Text>
              <Text className="text-sm text-slate-600">Reassign the users holding this role before deleting it.</Text>
              {deleteError ? (
                <View className="rounded-xl bg-danger-100 p-3">
                  <Text className="text-sm text-danger-700">{deleteError}</Text>
                </View>
              ) : null}
              {confirmingDelete ? (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => remove.mutate()}
                    disabled={remove.isPending}
                    className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-danger-700 active:opacity-90 disabled:opacity-60"
                  >
                    {remove.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Yes, delete it</Text>}
                  </Pressable>
                  <Pressable
                    onPress={() => setConfirmingDelete(false)}
                    disabled={remove.isPending}
                    className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100"
                  >
                    <Text className="text-sm font-bold text-slate-700">Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setDeleteError(null);
                    setConfirmingDelete(true);
                  }}
                  className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-danger-300 active:bg-danger-100"
                >
                  <Feather name="trash-2" size={16} color="#b91c1c" />
                  <Text className="text-sm font-bold text-danger-700">Delete role</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
