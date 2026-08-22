import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseTests } from "@/lib/data/course";
import type { CourseTest } from "@/types/lms";

const toneByStatus: Record<CourseTest["status"], "success" | "warning" | "info" | "neutral"> = {
  Available: "warning",
  Upcoming: "info",
  Completed: "success",
  Closed: "neutral",
};

export default function CourseTestsScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const router = useRouter();
  const tests = useQuery({ queryKey: ["student", "course", enrollmentId, "tests"], queryFn: () => fetchCourseTests(enrollmentId) });

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
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/(student)/courses/[enrollmentId]/tests/[testId]", params: { enrollmentId, testId: item.id } })}
            className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 active:bg-slate-50"
          >
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold text-slate-900">{item.title}</Text>
              <StatusBadge label={item.status} tone={toneByStatus[item.status]} />
            </View>
            <Text className="mt-1.5 text-xs text-slate-500">{item.availability}</Text>
            <Text className="mt-1 text-xs text-slate-500">
              {item.marks} · {item.attemptsLabel}
            </Text>
          </Pressable>
        )}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={tests.isRefetching}
        onRefresh={() => tests.refetch()}
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">No tests have been published for this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
