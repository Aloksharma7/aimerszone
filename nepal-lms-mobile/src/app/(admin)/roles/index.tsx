import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdminRoles } from "@/lib/data/admin";
import type { AdminRole } from "@/types/lms";

export default function AdminRolesScreen() {
  const router = useRouter();
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: fetchAdminRoles });

  return (
    <AppScreen edges={["top"]}>
      <View className="flex-row items-center justify-between px-5 pb-3 pt-6">
        <Text className="text-2xl font-bold text-slate-950">Roles</Text>
        <Pressable
          onPress={() => router.push("/(admin)/roles/new")}
          className="h-10 flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 active:bg-brand-800"
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text className="text-sm font-bold text-white">New</Text>
        </Pressable>
      </View>

      {roles.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : roles.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(roles.error) ? roles.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => roles.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={roles.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <RoleRow role={item} />}
          contentContainerClassName="gap-3 px-5 py-4"
          refreshing={roles.isRefetching}
          onRefresh={() => roles.refetch()}
        />
      )}
    </AppScreen>
  );
}

function RoleRow({ role }: { role: AdminRole }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(admin)/roles/[roleId]", params: { roleId: role.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{role.name}</Text>
        {role.protected ? (
          <View className="self-start rounded-full bg-slate-100 px-2.5 py-1">
            <Text className="text-xs font-semibold text-slate-600">Protected</Text>
          </View>
        ) : null}
      </View>
      {role.description ? (
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={2}>
          {role.description}
        </Text>
      ) : null}
      <Text className="mt-1.5 text-xs text-slate-400">
        {role.usersCount} user{role.usersCount === 1 ? "" : "s"} · {role.permissions.includes("*") ? "All permissions" : `${role.permissions.length} permission${role.permissions.length === 1 ? "" : "s"}`}
      </Text>
    </Pressable>
  );
}
