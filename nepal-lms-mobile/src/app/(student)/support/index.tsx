import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchSupportOverview } from "@/lib/data/student";
import type { SupportFaq, SupportTicket } from "@/types/lms";

const toneByStatus: Record<SupportTicket["status"], "warning" | "info" | "success" | "neutral"> = {
  Open: "warning",
  Pending: "info",
  Resolved: "success",
  Closed: "neutral",
};

export default function SupportOverviewScreen() {
  const router = useRouter();
  const support = useQuery({ queryKey: ["student", "support"], queryFn: fetchSupportOverview });

  if (support.isPending) {
    return (
      <AppScreen edges={["bottom"]}>
        <ListSkeleton withThumbnail={false} />
      </AppScreen>
    );
  }

  if (support.isError) {
    const message = isNormalizedApiError(support.error) ? support.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-4 bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => support.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = support.data;

  return (
    <AppScreen edges={["bottom"]}>
    <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 py-6">
      <Pressable
        onPress={() => router.push("/(student)/support/new")}
        className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text className="text-base font-bold text-white">New support request</Text>
      </Pressable>

      <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <Text className="text-sm font-bold text-slate-900">Contact the office</Text>
        {data.contactPhone ? <ContactRow icon="phone" label={data.contactPhone} onPress={() => Linking.openURL(`tel:${data.contactPhone}`)} /> : null}
        {data.contactWhatsapp ? (
          <ContactRow icon="message-circle" label={`WhatsApp: ${data.contactWhatsapp}`} onPress={() => Linking.openURL(`https://wa.me/${data.contactWhatsapp?.replace(/[^0-9]/g, "")}`)} />
        ) : null}
        {data.contactEmail ? <ContactRow icon="mail" label={data.contactEmail} onPress={() => Linking.openURL(`mailto:${data.contactEmail}`)} /> : null}
        {data.contactHours ? <ContactRow icon="clock" label={data.contactHours} /> : null}
      </View>

      {data.tickets.length > 0 ? (
        <Section title="Your requests">
          <View className="gap-2">
            {data.tickets.map((ticket) => (
              <View key={ticket.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
                    {ticket.subject}
                  </Text>
                  <StatusBadge label={ticket.status} tone={toneByStatus[ticket.status]} />
                </View>
                <Text className="mt-1 text-xs text-slate-500">
                  {ticket.reference} · {ticket.updatedAt}
                </Text>
                {ticket.replyCount > 0 ? (
                  <Text className="mt-1 text-xs font-medium text-brand-700">
                    {ticket.replyCount} repl{ticket.replyCount === 1 ? "y" : "ies"} from our team
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {data.faqs.length > 0 ? (
        <Section title="Frequently asked questions">
          <View className="gap-2">
            {data.faqs.map((faq) => (
              <FaqItem key={faq.id} faq={faq} />
            ))}
          </View>
        </Section>
      ) : null}
    </ScrollView>
    </AppScreen>
  );
}

function ContactRow({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="mt-3 flex-row items-center gap-3">
      <Feather name={icon} size={16} color="#1d4ed8" />
      <Text className={`text-sm ${onPress ? "font-medium text-brand-700" : "text-slate-700"}`}>{label}</Text>
    </Pressable>
  );
}

function FaqItem({ faq }: { faq: SupportFaq }) {
  const [open, setOpen] = useState(false);

  return (
    <Pressable onPress={() => setOpen((value) => !value)} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{faq.question}</Text>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
      </View>
      {open ? <Text className="mt-2 text-xs leading-5 text-slate-600">{faq.answer}</Text> : null}
    </Pressable>
  );
}
