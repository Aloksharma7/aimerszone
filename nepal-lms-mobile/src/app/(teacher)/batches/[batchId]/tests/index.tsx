import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherTestsForBatch } from "@/lib/data/teacher";
import type { TeacherTestSummary } from "@/types/lms";

export default function TeacherTestsScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const tests = useQuery({ queryKey: ["teacher", "batch", batchId, "tests"], queryFn: () => fetchTeacherTestsForBatch(batchId) });

  if (tests.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (tests.isError) {
    const message = isNormalizedApiError(tests.error) ? tests.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => tests.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlatList
        data={tests.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TestRow batchId={batchId} test={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/tests/new", params: { batchId } })}
            className="mb-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New test</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No tests have been created for this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function TestRow({ batchId, test }: { batchId: string; test: TeacherTestSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/tests/[testId]", params: { batchId, testId: test.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{test.title}</Text>
        <StatusBadge label={test.status === "open" ? "Published" : "Draft"} tone={test.status === "open" ? "success" : "neutral"} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">
        {test.durationMinutes} minutes · {test.attemptsAllowed} attempt{test.attemptsAllowed === 1 ? "" : "s"}
      </Text>
      <Text className="mt-1 text-xs font-medium text-brand-700">{test.submissionsCount} submission{test.submissionsCount === 1 ? "" : "s"}</Text>
    </Pressable>
  );
}
