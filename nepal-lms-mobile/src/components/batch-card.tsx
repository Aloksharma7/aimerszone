import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ProgressBar } from "@/components/progress-bar";
import type { TeacherBatchSummary } from "@/types/lms";

export function BatchCard({ batch }: { batch: TeacherBatchSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]", params: { batchId: batch.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
            {batch.courseTitle}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
            {batch.batchTitle} · {batch.studentsCount} student{batch.studentsCount === 1 ? "" : "s"}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color="#94a3b8" />
      </View>
      <Text className="mt-1.5 text-xs text-slate-500">{batch.scheduleSummary}</Text>
      <ProgressBar percent={batch.syllabusProgressPercent} />
      {batch.nextClassLabel ? (
        <Text className="mt-1.5 text-xs font-medium text-brand-700">
          Next: {batch.nextClassLabel} · {batch.nextClassAt}
        </Text>
      ) : null}
    </Pressable>
  );
}
