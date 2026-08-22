import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdminCategory, deleteAdminCategory, fetchAdminCategories, updateAdminCategory } from "@/lib/data/admin";
import type { AdminCategory } from "@/types/lms";

type Draft = { id: string | null; name: string; description: string; isActive: boolean };

const emptyDraft: Draft = { id: null, name: "", description: "", isActive: true };

export default function AdminCategoriesScreen() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: fetchAdminCategories });

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const editing = draft.id !== null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  }

  function reset() {
    setDraft(emptyDraft);
    setError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = { name: draft.name.trim(), description: draft.description.trim() || undefined, isActive: draft.isActive };
      if (editing) {
        await updateAdminCategory(draft.id as string, input);
      } else {
        await createAdminCategory(input);
      }
    },
    onSuccess: () => {
      reset();
      refresh();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The category could not be saved."),
  });

  const remove = useMutation({
    mutationFn: (category: AdminCategory) => deleteAdminCategory(category.id),
    onSuccess: () => refresh(),
    onError: (err) => Alert.alert("Category not deleted", isNormalizedApiError(err) ? err.message : "The category could not be deleted."),
  });

  function confirmDelete(category: AdminCategory) {
    Alert.alert(`Delete the category "${category.name}"?`, undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete category", style: "destructive", onPress: () => remove.mutate(category) },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <FlatList
        data={categories.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CategoryRow
            category={item}
            onEdit={() => {
              setDraft({ id: item.id, name: item.name, description: item.description ?? "", isActive: item.isActive });
              setError(null);
            }}
            onDelete={() => confirmDelete(item)}
            deleting={remove.isPending && remove.variables?.id === item.id}
          />
        )}
        contentContainerClassName="gap-3 px-5 pb-8"
        refreshing={categories.isRefetching}
        onRefresh={() => categories.refetch()}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-6">
            <Text className="text-2xl font-bold text-slate-950">Course categories</Text>
            <Text className="text-sm text-slate-500">
              Categories group courses on the public catalogue. At least one is needed before a course can be created.
            </Text>

            <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-base font-bold text-slate-950">{editing ? "Edit category" : "New category"}</Text>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Name</Text>
                <TextInput
                  value={draft.name}
                  onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
                  placeholder="Management"
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Description</Text>
                <TextInput
                  value={draft.description}
                  onChangeText={(value) => setDraft((current) => ({ ...current, description: value }))}
                  placeholder="Shown under the category heading on the catalogue."
                  multiline
                  textAlignVertical="top"
                  className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-700">Visible on the public catalogue</Text>
                <Switch value={draft.isActive} onValueChange={(value) => setDraft((current) => ({ ...current, isActive: value }))} />
              </View>

              {error ? (
                <View className="rounded-xl bg-danger-100 p-3">
                  <Text className="text-sm text-danger-700">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => save.mutate()}
                  disabled={save.isPending || draft.name.trim().length < 2}
                  className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
                >
                  {save.isPending ? <ActivityIndicator color="#fff" /> : <Feather name={editing ? "save" : "plus"} size={16} color="#fff" />}
                  <Text className="text-sm font-bold text-white">{editing ? "Save changes" : "Create category"}</Text>
                </Pressable>
                {editing ? (
                  <Pressable onPress={reset} className="h-11 items-center justify-center rounded-xl border border-slate-300 px-4 active:bg-slate-100">
                    <Text className="text-sm font-bold text-slate-700">Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {categories.isPending ? <ActivityIndicator color="#1d4ed8" /> : null}
            {categories.isError ? (
              <Text className="text-sm text-danger-700">{isNormalizedApiError(categories.error) ? categories.error.message : "Something went wrong."}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          categories.isPending ? null : (
            <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No categories yet. Create the first one to start building the catalogue.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
  deleting,
}: {
  category: AdminCategory;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900">{category.name}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">{category.slug}</Text>
        </View>
        <View className={`self-start rounded-full px-2.5 py-1 ${category.isActive ? "bg-success-100" : "bg-slate-100"}`}>
          <Text className={`text-xs font-semibold ${category.isActive ? "text-success-700" : "text-slate-600"}`}>{category.isActive ? "Active" : "Hidden"}</Text>
        </View>
      </View>
      <Text className="mt-1.5 text-xs text-slate-500">{category.courseCount} course{category.courseCount === 1 ? "" : "s"}</Text>
      <View className="mt-3 flex-row gap-2">
        <Pressable onPress={onEdit} className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-300 active:bg-slate-100">
          <Feather name="edit-2" size={14} color="#334155" />
          <Text className="text-xs font-semibold text-slate-700">Edit</Text>
        </Pressable>
        {category.courseCount > 0 ? (
          <View className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-danger-200 opacity-50">
            <Feather name="trash-2" size={14} color="#b91c1c" />
            <Text className="text-xs font-semibold text-danger-700">Delete</Text>
          </View>
        ) : (
          <Pressable
            onPress={onDelete}
            disabled={deleting}
            className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-danger-300 active:bg-danger-100"
          >
            {deleting ? <ActivityIndicator size="small" color="#b91c1c" /> : <Feather name="trash-2" size={14} color="#b91c1c" />}
            <Text className="text-xs font-semibold text-danger-700">Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
