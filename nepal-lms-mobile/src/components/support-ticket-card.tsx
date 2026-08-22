import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { StatusBadge } from "@/components/status-badge";
import type { SupportTicketSummary } from "@/types/lms";

const statusTone = {
  open: "info",
  pending: "warning",
  resolved: "success",
  closed: "neutral",
} as const;

const priorityTone = {
  high: "danger",
  normal: "neutral",
  low: "neutral",
} as const;

export function SupportTicketCard({ ticket }: { ticket: SupportTicketSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(staff)/support/[ticketId]", params: { ticketId: ticket.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {ticket.subject}
        </Text>
        <StatusBadge label={ticket.status} tone={statusTone[ticket.status]} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
        {ticket.reference} · {ticket.studentName || "Unknown student"}
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          {ticket.priority !== "normal" ? <StatusBadge label={ticket.priority} tone={priorityTone[ticket.priority]} /> : null}
          <Text className="text-xs text-slate-500">{ticket.messageCount} message{ticket.messageCount === 1 ? "" : "s"}</Text>
        </View>
        <Text className="text-xs text-slate-400">{ticket.updatedAt}</Text>
      </View>
      {ticket.assigneeName ? <Text className="mt-1 text-xs text-slate-500">Assigned to {ticket.assigneeName}</Text> : null}
    </Pressable>
  );
}
