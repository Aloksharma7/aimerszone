import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Switch, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createAdminFaq, deleteAdminFaq, fetchAdminFaqs, updateAdminFaq } from "@/lib/data/admin";
import type { AdminFaq } from "@/types/lms";

type Draft = { id: string | null; question: string; answer: string; category: string; isPublished: boolean };

const emptyDraft: Draft = { id: null, question: "", answer: "", category: "general", isPublished: true };

export default function AdminFaqsScreen() {
  const queryClient = useQueryClient();
  const faqs = useQuery({ queryKey: ["admin", "faqs"], queryFn: fetchAdminFaqs });

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const editing = draft.id !== null;

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "faqs"] });
  }

  function reset() {
    setDraft(emptyDraft);
    setError(null);
  }

  const save = useMutation({
    mutationFn: async () => {
      const input = { question: draft.question.trim(), answer: draft.answer.trim(), category: draft.category.trim() || undefined, isPublished: draft.isPublished };
      if (editing) {
        await updateAdminFaq(draft.id as string, input);
      } else {
        await createAdminFaq(input);
      }
    },
    onSuccess: () => {
      reset();
      refresh();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The FAQ could not be saved."),
  });

  const remove = useMutation({
    mutationFn: (faq: AdminFaq) => deleteAdminFaq(faq.id),
    onSuccess: () => refresh(),
    onError: (err) => Alert.alert("FAQ not removed", isNormalizedApiError(err) ? err.message : "The FAQ could not be removed."),
  });

  function confirmDelete(faq: AdminFaq) {
    Alert.alert("Remove this FAQ?", faq.question, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(faq) },
    ]);
  }

  const valid = draft.question.trim().length >= 5 && draft.answer.trim().length >= 5;

  return (
    <AppScreen edges={["bottom"]}>
      <FlatList
        data={faqs.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FaqRow
            faq={item}
            onEdit={() => {
              setDraft({ id: item.id, question: item.question, answer: item.answer, category: item.category, isPublished: item.isPublished });
              setError(null);
            }}
            onDelete={() => confirmDelete(item)}
            deleting={remove.isPending && remove.variables?.id === item.id}
          />
        )}
        contentContainerClassName="gap-3 px-5 pb-8"
        refreshing={faqs.isRefetching}
        onRefresh={() => faqs.refetch()}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-6">
            <Text className="text-sm text-slate-500">Shown on the public site and the student support page.</Text>

            <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-base font-bold text-slate-950">{editing ? "Edit FAQ" : "New FAQ"}</Text>

              <TextField label="Question" value={draft.question} onChangeText={(value) => setDraft((current) => ({ ...current, question: value }))} />

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Answer</Text>
                <TextInput
                  value={draft.answer}
                  onChangeText={(value) => setDraft((current) => ({ ...current, answer: value }))}
                  multiline
                  textAlignVertical="top"
                  className="h-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                />
              </View>

              <TextField
                label="Category"
                value={draft.category}
                onChangeText={(value) => setDraft((current) => ({ ...current, category: value }))}
                placeholder="general"
              />

              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-700">Published</Text>
                <Switch value={draft.isPublished} onValueChange={(value) => setDraft((current) => ({ ...current, isPublished: value }))} />
              </View>

              {error ? (
                <View className="rounded-xl bg-danger-100 p-3">
                  <Text className="text-sm text-danger-700">{error}</Text>
                </View>
              ) : null}

              <View className="flex-row gap-3">
                <Button
                  label={editing ? "Save changes" : "Create FAQ"}
                  loading={save.isPending}
                  disabled={!valid}
                  icon={editing ? "save" : "plus"}
                  onPress={() => save.mutate()}
                />
                {editing ? <Button label="Cancel" variant="secondary" fullWidth={false} onPress={reset} /> : null}
              </View>
            </View>

            {faqs.isPending ? <ActivityIndicator color="#1d4ed8" /> : null}
          </View>
        }
        ListEmptyComponent={
          faqs.isPending ? null : (
            <EmptyState icon="help-circle" title="No FAQs yet" description="Questions you add will show up here and on the public site." />
          )
        }
      />
    </AppScreen>
  );
}

function FaqRow({ faq, onEdit, onDelete, deleting }: { faq: AdminFaq; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={2}>
          {faq.question}
        </Text>
        <View className={`self-start rounded-full px-2.5 py-1 ${faq.isPublished ? "bg-success-100" : "bg-slate-100"}`}>
          <Text className={`text-xs font-semibold ${faq.isPublished ? "text-success-700" : "text-slate-600"}`}>{faq.isPublished ? "Published" : "Hidden"}</Text>
        </View>
      </View>
      <Text className="mt-1 text-xs text-slate-500" numberOfLines={3}>
        {faq.answer}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-400">{faq.category}</Text>
      <View className="mt-3 flex-row gap-2">
        <Pressable onPress={onEdit} className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-300 active:bg-slate-100">
          <Feather name="edit-2" size={14} color="#334155" />
          <Text className="text-xs font-semibold text-slate-700">Edit</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={deleting}
          className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-danger-300 active:bg-danger-100"
        >
          {deleting ? <ActivityIndicator size="small" color="#b91c1c" /> : <Feather name="trash-2" size={14} color="#b91c1c" />}
          <Text className="text-xs font-semibold text-danger-700">Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}
