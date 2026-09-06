import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Checkbox } from "@/components/checkbox";
import { TextField } from "@/components/text-field";
import { fetchAdminPermissions, type AdminRoleInput } from "@/lib/data/admin";
import type { AdminPermission, AdminRole } from "@/types/lms";

function initialValues(role?: AdminRole | null): AdminRoleInput {
  return {
    name: role?.name ?? "",
    description: role?.description ?? "",
    permissions: role?.permissions ?? [],
  };
}

export function useAdminRoleForm(role?: AdminRole | null) {
  const [values, setValues] = useState<AdminRoleInput>(() => initialValues(role));

  function update<K extends keyof AdminRoleInput>(key: K, value: AdminRoleInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function togglePermission(key: string) {
    setValues((current) => ({
      ...current,
      permissions: current.permissions.includes(key) ? current.permissions.filter((item) => item !== key) : [...current.permissions, key],
    }));
  }

  function hydrate(role: AdminRole) {
    setValues(initialValues(role));
  }

  function validate(): string | null {
    if (values.name.trim().length < 3) return "Enter a role name of at least 3 characters.";
    return null;
  }

  return { values, update, togglePermission, hydrate, validate };
}

export function AdminRoleFormFields({
  values,
  update,
  togglePermission,
}: {
  values: AdminRoleInput;
  update: <K extends keyof AdminRoleInput>(key: K, value: AdminRoleInput[K]) => void;
  togglePermission: (key: string) => void;
}) {
  const permissions = useQuery({ queryKey: ["admin", "permissions"], queryFn: fetchAdminPermissions });

  const groups = new Map<string, AdminPermission[]>();
  (permissions.data ?? []).forEach((permission) => {
    const list = groups.get(permission.group) ?? [];
    list.push(permission);
    groups.set(permission.group, list);
  });

  return (
    <View className="gap-4">
      <TextField label="Role name" value={values.name} onChangeText={(value) => update("name", value)} />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Description (optional)</Text>
        <TextInput
          value={values.description}
          onChangeText={(value) => update("description", value)}
          multiline
          textAlignVertical="top"
          className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        />
      </View>

      <View className="gap-3">
        <Text className="text-sm font-semibold text-slate-700">Permissions</Text>
        {[...groups.entries()].map(([group, items]) => (
          <View key={group} className="gap-1 rounded-xl border border-slate-200 bg-white p-2">
            <Text className="px-2 pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{group}</Text>
            {items.map((permission) => (
              <Checkbox
                key={permission.id}
                checked={values.permissions.includes(permission.key)}
                onToggle={() => togglePermission(permission.key)}
                label={permission.key}
                description={permission.description ?? undefined}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
