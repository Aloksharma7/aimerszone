import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgressBar } from "@/components/progress-bar";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherBatchDetail } from "@/lib/data/teacher";
import type { BatchStudent } from "@/types/lms";

export default function TeacherBatchDetailScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const detail = useQuery({ queryKey: ["teacher", "batch", batchId], queryFn: () => fetchTeacherBatchDetail(batchId) });

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

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={data.students}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StudentRow student={item} />}
        contentContainerClassName="gap-3 px-5 py-6"
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <View>
              <Text className="text-xl font-bold text-slate-950">{data.batch.courseTitle}</Text>
              <Text className="mt-0.5 text-sm text-slate-500">{data.batch.batchTitle}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{data.batch.scheduleSummary}</Text>
              <ProgressBar percent={data.batch.syllabusProgressPercent} />
            </View>

            <View className="flex-row flex-wrap gap-3">
              <CountTile label="Classes" value={data.counts.classes} />
              <CountTile label="Attendance" value={`${data.counts.attendancePercent}%`} />
              <CountTile label="Recordings" value={data.counts.recordings} onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/recordings", params: { batchId } })} />
              <CountTile label="Resources" value={data.counts.resources} onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/resources", params: { batchId } })} />
              <CountTile label="Tests" value={data.counts.tests} onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/tests", params: { batchId } })} />
            </View>

            <Text className="text-sm font-bold text-slate-900">Students ({data.students.length})</Text>
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No students are enrolled in this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function CountTile({ label, value, onPress }: { label: string; value: string | number; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`min-w-[80px] flex-1 gap-1 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm ${onPress ? "active:bg-slate-50" : ""}`}
    >
      <Text className="text-lg font-bold text-slate-950">{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </Pressable>
  );
}

function StudentRow({ student }: { student: BatchStudent }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
        <Feather name="user" size={16} color="#1d4ed8" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{student.name}</Text>
        <Text className="mt-0.5 text-xs text-slate-500">{student.mobile || student.email || student.studentCode || "—"}</Text>
      </View>
    </View>
  );
}
