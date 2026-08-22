import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MetricTile } from "@/components/metric-tile";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherTestResults } from "@/lib/data/teacher";
import type { TestResultRow } from "@/types/lms";

export default function TeacherTestResultsScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const results = useQuery({ queryKey: ["teacher", "test", testId, "results"], queryFn: () => fetchTeacherTestResults(testId) });

  if (results.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (results.isError) {
    const message = isNormalizedApiError(results.error) ? results.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => results.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = results.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={data.attempts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AttemptRow attempt={item} totalMarks={data.test.totalMarks} />}
        contentContainerClassName="gap-3 px-5 py-6"
        ListHeaderComponent={
          <View className="mb-4 gap-4">
            <Text className="text-xl font-bold text-slate-950">{data.test.title}</Text>
            <View className="flex-row flex-wrap gap-3">
              <MetricTile label="Submissions" value={data.metrics.submissions} />
              <MetricTile label="Graded" value={data.metrics.graded} />
              <MetricTile label="Passed" value={data.metrics.passed} />
            </View>
            {data.metrics.averageScore !== null ? (
              <Text className="text-sm text-slate-600">Average score: {data.metrics.averageScore} / {data.test.totalMarks}</Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No students have submitted this test yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function AttemptRow({ attempt, totalMarks }: { attempt: TestResultRow; totalMarks: number }) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{attempt.studentName}</Text>
        {attempt.status === "graded" ? (
          <StatusBadge label={attempt.passed ? "Passed" : "Failed"} tone={attempt.passed ? "success" : "danger"} />
        ) : (
          <StatusBadge label="Ungraded" tone="neutral" />
        )}
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {attempt.studentCode ? `${attempt.studentCode} · ` : ""}Attempt {attempt.attemptNumber}
        {attempt.autoSubmitted ? " · Auto-submitted" : ""}
      </Text>
      {attempt.score !== null ? (
        <Text className="mt-1 text-sm font-bold text-slate-900">
          {attempt.score} / {totalMarks}
        </Text>
      ) : null}
    </View>
  );
}
