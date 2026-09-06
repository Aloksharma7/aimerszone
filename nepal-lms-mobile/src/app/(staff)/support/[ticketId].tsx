import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchSupportAssignees, fetchSupportTicketDetail, replySupportTicket, updateSupportTicket } from "@/lib/data/staff";
import type { SupportMessage, SupportTicketPriority, SupportTicketStatus } from "@/types/lms";

const statusOptions: { value: SupportTicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const priorityOptions: { value: SupportTicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const statusTone = { open: "info", pending: "warning", resolved: "success", closed: "neutral" } as const;

export default function StaffSupportTicketScreen() {
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticket = useQuery({ queryKey: ["staff", "support", "ticket", ticketId], queryFn: () => fetchSupportTicketDetail(ticketId) });
  const assignees = useQuery({ queryKey: ["staff", "support", "assignees"], queryFn: fetchSupportAssignees, enabled: ticket.data?.canManage === true });

  function refreshAfterChange() {
    queryClient.invalidateQueries({ queryKey: ["staff", "support", "ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: ["staff", "support"], exact: false });
  }

  const sendReply = useMutation({
    mutationFn: () => replySupportTicket(ticketId, reply.trim(), internalNote),
    onSuccess: () => {
      setReply("");
      setInternalNote(false);
      setError(null);
      refreshAfterChange();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not send this reply."),
  });

  const updateTicket = useMutation({
    mutationFn: (input: Parameters<typeof updateSupportTicket>[1]) => updateSupportTicket(ticketId, input),
    onSuccess: () => refreshAfterChange(),
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not update this ticket."),
  });

  if (ticket.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (ticket.isError) {
    const message = isNormalizedApiError(ticket.error) ? ticket.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => ticket.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = ticket.data;

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-lg font-bold text-slate-950">{data.subject}</Text>
              <StatusBadge label={data.status} tone={statusTone[data.status]} />
            </View>
            <Text className="mt-0.5 text-xs text-slate-500">{data.reference}</Text>
            <Text className="mt-2 text-sm text-slate-700">{data.studentName || "Unknown student"}</Text>
            {data.email ? <Text className="text-xs text-slate-500">{data.email}</Text> : null}
            {data.mobile ? <Text className="text-xs text-slate-500">{data.mobile}</Text> : null}
            <View className="mt-3 rounded-xl bg-slate-50 p-3">
              <Text className="text-sm text-slate-700">{data.message}</Text>
            </View>
          </View>

          <View className="gap-3">
            {data.messages.length === 0 ? (
              <Text className="text-center text-sm text-slate-400">No replies yet.</Text>
            ) : (
              data.messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </View>

          {data.canManage ? (
            <View className="gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</Text>
                <View className="flex-row flex-wrap gap-2">
                  {statusOptions.map((option) => {
                    const selected = data.status === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => updateTicket.mutate({ status: option.value })}
                        disabled={updateTicket.isPending}
                        className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</Text>
                <View className="flex-row flex-wrap gap-2">
                  {priorityOptions.map((option) => {
                    const selected = data.priority === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => updateTicket.mutate({ priority: option.value })}
                        disabled={updateTicket.isPending}
                        className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {assignees.data ? (
                <View className="gap-2">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned to</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-2">
                      {assignees.data.map((person) => {
                        const selected = data.assigneeName === person.name;
                        return (
                          <Pressable
                            key={person.id}
                            onPress={() => updateTicket.mutate({ assignedTo: person.id })}
                            disabled={updateTicket.isPending}
                            className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                          >
                            <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{person.name}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          ) : null}

          {error ? (
            <View className="rounded-xl bg-danger-100 p-3">
              <Text className="text-sm text-danger-700">{error}</Text>
            </View>
          ) : null}

          <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Write a reply…"
              multiline
              textAlignVertical="top"
              className="h-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
              editable={!sendReply.isPending}
            />
            {data.canManage ? (
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-600">Internal note (student won&apos;t see this)</Text>
                <Switch value={internalNote} onValueChange={setInternalNote} />
              </View>
            ) : null}
            <Pressable
              onPress={() => {
                setError(null);
                sendReply.mutate();
              }}
              disabled={reply.trim().length < 2 || sendReply.isPending}
              className="h-11 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
            >
              {sendReply.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Send</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const tone = message.isInternal ? "bg-warning-100" : message.fromStudent ? "bg-white border border-slate-100" : "bg-brand-50";
  return (
    <View className={`rounded-2xl p-3.5 shadow-sm ${tone}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-slate-700">
          {message.authorName}
          {message.isInternal ? " · Internal note" : ""}
        </Text>
        <Text className="text-xs text-slate-400">{message.createdAt}</Text>
      </View>
      <Text className="mt-1 text-sm text-slate-800">{message.body}</Text>
    </View>
  );
}
