import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateTimeField } from "@/components/date-time-field";
import { MetricTile } from "@/components/metric-tile";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import {
  createAdminAnnouncement,
  fetchAdminAnnouncements,
  fetchAdminBatchesPage,
  fetchAdminCourseOptions,
  type NewAdminAnnouncementInput,
} from "@/lib/data/admin";
import type { AdminAnnouncement } from "@/types/lms";

const audienceOptions: { value: NewAdminAnnouncementInput["audience"]; label: string }[] = [
  { value: "all", label: "All active users" },
  { value: "course", label: "One course" },
  { value: "batch", label: "One batch" },
  { value: "role", label: "One role" },
];

const roleOptions = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
  { value: "super_admin", label: "Super Admin" },
];

const channelOptions: { value: NewAdminAnnouncementInput["channel"]; label: string }[] = [
  { value: "portal", label: "Portal" },
  { value: "email", label: "Portal + Email" },
  { value: "sms", label: "Portal + SMS" },
  { value: "whatsapp", label: "Portal + WhatsApp" },
];

const statusTone: Record<AdminAnnouncement["status"], "neutral" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  scheduled: "warning",
  published: "success",
  archived: "danger",
};

function combine(date: Date, time: Date): Date {
  const result = new Date(date);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

export default function AdminAnnouncementsScreen() {
  const queryClient = useQueryClient();
  const announcements = useQuery({ queryKey: ["admin", "announcements"], queryFn: fetchAdminAnnouncements });
  const courses = useQuery({ queryKey: ["admin", "course-options"], queryFn: fetchAdminCourseOptions });
  const batches = useQuery({ queryKey: ["admin", "batch-options"], queryFn: () => fetchAdminBatchesPage(1) });

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NewAdminAnnouncementInput["audience"]>("all");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [channel, setChannel] = useState<NewAdminAnnouncementInput["channel"]>("portal");
  const [scheduled, setScheduled] = useState(false);
  const [publishDate, setPublishDate] = useState(new Date());
  const [publishTime, setPublishTime] = useState(new Date());
  const [pinned, setPinned] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      createAdminAnnouncement({
        title: title.trim(),
        summary: summary.trim() || undefined,
        body: body.trim(),
        audience,
        courseId: audience === "course" ? targetId ?? undefined : undefined,
        batchId: audience === "batch" ? targetId ?? undefined : undefined,
        roleKey: audience === "role" ? targetId ?? undefined : undefined,
        channel,
        publishAt: scheduled ? combine(publishDate, publishTime).toISOString() : undefined,
        pinned,
        link: link.trim() || undefined,
      }),
    onSuccess: () => {
      setTitle("");
      setSummary("");
      setBody("");
      setAudience("all");
      setTargetId(null);
      setChannel("portal");
      setScheduled(false);
      setPinned(false);
      setLink("");
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The announcement could not be saved."),
  });

  const valid = title.trim().length >= 4 && body.trim().length >= 10 && (audience === "all" || Boolean(targetId));
  const targets = audience === "course" ? (courses.data ?? []).map((c) => ({ id: c.id, label: c.title })) : audience === "batch" ? (batches.data?.items ?? []).map((b) => ({ id: b.id, label: b.title })) : audience === "role" ? roleOptions.map((r) => ({ id: r.value, label: r.label })) : [];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <FlatList
        data={announcements.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnnouncementRow announcement={item} />}
        contentContainerClassName="gap-3 px-5 pb-8"
        refreshing={announcements.isRefetching}
        onRefresh={() => announcements.refetch()}
        ListHeaderComponent={
          <View className="gap-4 pb-4 pt-6">
            <Text className="text-2xl font-bold text-slate-950">Announcements</Text>

            {announcements.data ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-3">
                  <MetricTile label="Published (mo)" value={announcements.data.metrics.publishedMonth} />
                  <MetricTile label="Scheduled" value={announcements.data.metrics.scheduled} />
                  <MetricTile label="Delivery rate" value={`${announcements.data.metrics.deliveryRatePercent}%`} />
                </View>
              </ScrollView>
            ) : null}

            <View className="gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <Text className="text-base font-bold text-slate-950">Create announcement</Text>
              <Text className="text-xs text-slate-500">Private meeting and file links must never be pasted into the message.</Text>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Title</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  maxLength={180}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Summary (optional)</Text>
                <TextInput
                  value={summary}
                  onChangeText={setSummary}
                  maxLength={500}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Message</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  textAlignVertical="top"
                  maxLength={20000}
                  className="h-28 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Audience</Text>
                <View className="flex-row flex-wrap gap-2">
                  {audienceOptions.map((option) => {
                    const selected = audience === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          setAudience(option.value);
                          setTargetId(null);
                        }}
                        className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {targets.length > 0 ? (
                <View className="gap-2">
                  <Text className="text-sm font-semibold text-slate-700">Target</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {targets.map((target) => {
                      const selected = targetId === target.id;
                      return (
                        <Pressable
                          key={target.id}
                          onPress={() => setTargetId(target.id)}
                          className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                        >
                          <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{target.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Channel</Text>
                <View className="flex-row flex-wrap gap-2">
                  {channelOptions.map((option) => {
                    const selected = channel === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setChannel(option.value)}
                        className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-slate-700">Schedule for later</Text>
                  <Switch value={scheduled} onValueChange={setScheduled} />
                </View>
                {scheduled ? (
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <DateTimeField label="Date" mode="date" value={publishDate} onChange={setPublishDate} minimumDate={new Date()} />
                    </View>
                    <View className="flex-1">
                      <DateTimeField label="Time" mode="time" value={publishTime} onChange={setPublishTime} />
                    </View>
                  </View>
                ) : (
                  <Text className="text-xs text-slate-500">Leave off to publish immediately.</Text>
                )}
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold text-slate-700">Link (optional)</Text>
                <TextInput
                  value={link}
                  onChangeText={setLink}
                  autoCapitalize="none"
                  placeholder="https://…"
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-slate-700">Pin to top</Text>
                <Switch value={pinned} onValueChange={setPinned} />
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
                {submit.isPending ? <ActivityIndicator color="#fff" /> : <Feather name="send" size={16} color="#fff" />}
                <Text className="text-sm font-bold text-white">{scheduled ? "Schedule announcement" : "Publish now"}</Text>
              </Pressable>
            </View>

            <Text className="text-sm font-bold text-slate-900">History</Text>
            {announcements.isPending ? <ActivityIndicator color="#1d4ed8" /> : null}
          </View>
        }
        ListEmptyComponent={
          announcements.isPending ? null : (
            <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No announcements yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function AnnouncementRow({ announcement }: { announcement: AdminAnnouncement }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={2}>
          {announcement.title}
        </Text>
        <StatusBadge label={announcement.status} tone={statusTone[announcement.status]} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {announcement.audienceLabel} · {announcement.channelLabel}
      </Text>
      <Text className="mt-1.5 text-xs text-slate-400">
        {announcement.authorName} · {announcement.scheduledLabel}
      </Text>
    </View>
  );
}
