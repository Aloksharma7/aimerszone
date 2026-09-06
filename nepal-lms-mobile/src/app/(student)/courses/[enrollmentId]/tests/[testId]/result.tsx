import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAttemptResult } from "@/lib/data/attempts";

export default function TestResultScreen() {
  const { enrollmentId, attemptId } = useLocalSearchParams<{ enrollmentId: string; attemptId: string }>();
  const router = useRouter();
  const result = useQuery({ queryKey: ["student", "attempt", attemptId, "result"], queryFn: () => fetchAttemptResult(attemptId) });

  if (result.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (result.isError) {
    const message = isNormalizedApiError(result.error) ? result.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
      </SafeAreaView>
    );
  }

  const data = result.data;
  const passed = data.releaseState === "released" && data.score !== null && data.score >= data.passMarks;
  const reattemptTestId = data.reattemptTestId;

  return (
    <AppScreen edges={["bottom"]}>
      <View className="flex-1 gap-4 px-6 py-6">
        <View className={`items-center rounded-2xl p-6 ${data.releaseState === "released" ? (passed ? "bg-success-100" : "bg-danger-100") : "bg-slate-100"}`}>
          <Feather
            name={data.releaseState === "pending" ? "clock" : passed ? "check-circle" : "x-circle"}
            size={32}
            color={data.releaseState === "pending" ? "#64748b" : passed ? "#15803d" : "#b91c1c"}
          />
          <Text className="mt-2 text-lg font-bold text-slate-900">
            {data.releaseState === "pending" ? "Submitted" : passed ? "Passed" : "Not passed"}
          </Text>
          {data.releaseState === "released" ? (
            <Text className="mt-1 text-2xl font-bold text-slate-950">
              {data.score} / {data.totalMarks}
            </Text>
          ) : (
            <Text className="mt-1 text-sm text-slate-600">Your result will be released once grading is complete.</Text>
          )}
        </View>

        {data.releaseState === "released" ? (
          <View className="flex-row gap-3">
            <ResultTile label="Correct" value={data.correct ?? 0} />
            <ResultTile label="Incorrect" value={data.incorrect ?? 0} />
            <ResultTile label="Unanswered" value={data.unanswered ?? 0} />
          </View>
        ) : null}

        <View className="mt-auto gap-3">
          {reattemptTestId ? (
            <Pressable
              onPress={() => router.replace({ pathname: "/(student)/courses/[enrollmentId]/tests/[testId]", params: { enrollmentId, testId: reattemptTestId } })}
              className="h-12 flex-row items-center justify-center rounded-xl border border-brand-700 active:bg-brand-50"
            >
              <Text className="text-base font-bold text-brand-700">Attempt again ({data.attemptsRemaining} left)</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.replace({ pathname: "/(student)/courses/[enrollmentId]/tests", params: { enrollmentId } })}
            className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Text className="text-base font-bold text-white">Back to tests</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

function ResultTile({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <Text className="text-xl font-bold text-slate-950">{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}
