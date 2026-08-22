import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAttendanceDetail, finalizeAttendance, saveAttendance } from "@/lib/data/teacher";
import type { AttendanceStatus } from "@/types/lms";

const statusOptions: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
  { value: "review", label: "Review" },
];

const statusColor: Record<AttendanceStatus, string> = {
  present: "border-success-700 bg-success-100",
  late: "border-warning-700 bg-warning-100",
  absent: "border-danger-700 bg-danger-100",
  excused: "border-info-700 bg-info-100",
  review: "border-slate-400 bg-slate-100",
};

export default function AttendanceDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["teacher", "attendance", sessionId], queryFn: () => fetchAttendanceDetail(sessionId) });
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notice, setNotice] = useState<string | null>(null);

  // Local, editable copy of each student's status — seeded from the fetched
  // register the first time it loads for this session. Adjusted during
  // render (React's documented pattern for deriving state from a prop/query
  // change) rather than in an effect, which would risk a cascading re-render.
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  if (detail.data && initializedFor !== detail.data.session.id) {
    setStatuses(Object.fromEntries(detail.data.participants.map((participant) => [participant.studentId, participant.status])));
    setInitializedFor(detail.data.session.id);
  }

  const updates = () => Object.entries(statuses).map(([studentId, status]) => ({ studentId, status }));

  const save = useMutation({
    mutationFn: () => saveAttendance(sessionId, updates()),
    onSuccess: () => setNotice("Draft saved."),
    onError: (error) => setNotice(isNormalizedApiError(error) ? error.message : "Could not save."),
  });

  const finalize = useMutation({
    mutationFn: () => finalizeAttendance(sessionId, updates()),
    onSuccess: () => {
      setNotice("Attendance finalized.");
      queryClient.invalidateQueries({ queryKey: ["teacher", "attendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
      detail.refetch();
    },
    onError: (error) => setNotice(isNormalizedApiError(error) ? error.message : "Could not finalize."),
  });

  if (detail.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (detail.isError) {
    const message = isNormalizedApiError(detail.error) ? detail.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => detail.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = detail.data;
  const finalized = data.summary.finalized;
  const busy = save.isPending || finalize.isPending;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={data.participants}
        keyExtractor={(item) => item.studentId}
        renderItem={({ item }) => (
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Text className="text-sm font-semibold text-slate-900">{item.studentName}</Text>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {statusOptions.map((option) => {
                const selected = statuses[item.studentId] === option.value;
                return (
                  <Pressable
                    key={option.value}
                    disabled={finalized}
                    onPress={() => setStatuses((current) => ({ ...current, [item.studentId]: option.value }))}
                    className={`rounded-full border px-3 py-1.5 ${selected ? statusColor[option.value] : "border-slate-200 bg-white"}`}
                  >
                    <Text className={`text-xs font-medium ${selected ? "text-slate-900" : "text-slate-500"}`}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        contentContainerClassName="gap-3 px-5 py-6"
        ListHeaderComponent={
          <View className="mb-4 gap-2">
            <Text className="text-xl font-bold text-slate-950">{data.session.title}</Text>
            <Text className="text-sm text-slate-500">
              {data.session.batchTitle} · {data.session.date}, {data.session.timeRange}
            </Text>
            {finalized ? (
              <View className="rounded-xl bg-success-100 p-3">
                <Text className="text-sm text-success-700">This register is finalized and can no longer be changed here.</Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          finalized ? null : (
            <View className="mt-2 gap-3">
              {notice ? (
                <View className="rounded-xl bg-info-100 p-3">
                  <Text className="text-sm text-info-700">{notice}</Text>
                </View>
              ) : null}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setNotice(null);
                    save.mutate();
                  }}
                  disabled={busy}
                  className="h-12 flex-1 flex-row items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100 disabled:opacity-60"
                >
                  {save.isPending ? <ActivityIndicator color="#1d4ed8" /> : <Text className="text-sm font-bold text-slate-700">Save draft</Text>}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setNotice(null);
                    finalize.mutate();
                  }}
                  disabled={busy}
                  className="h-12 flex-1 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
                >
                  {finalize.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Finalize</Text>}
                </Pressable>
              </View>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
