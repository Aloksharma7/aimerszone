import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
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
        <Button label="Try again" onPress={() => results.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = results.data;

  return (
    <AppScreen edges={["bottom"]}>
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
          <EmptyState icon="users" title="No submissions yet" description="Results will appear here once students start taking this test." />
        }
      />
    </AppScreen>
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
