import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTestLaunch, startAttempt } from "@/lib/data/attempts";

export default function TestLaunchScreen() {
  const { enrollmentId, testId } = useLocalSearchParams<{ enrollmentId: string; testId: string }>();
  const router = useRouter();
  const launch = useQuery({ queryKey: ["student", "test", testId, "launch"], queryFn: () => fetchTestLaunch(testId) });

  const start = useMutation({
    mutationFn: () => startAttempt(testId),
    onSuccess: (attempt) => {
      router.replace({
        pathname: "/(student)/courses/[enrollmentId]/tests/[testId]/attempt",
        params: { enrollmentId, testId, attemptId: attempt.id },
      });
    },
  });

  if (launch.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (launch.isError) {
    const message = isNormalizedApiError(launch.error) ? launch.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => launch.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = launch.data;
  const minutes = Math.round(data.durationSeconds / 60);

  return (
    <AppScreen edges={["bottom"]}>
      <View className="flex-1 gap-4 px-6 py-6">
        <View>
          <Text className="text-xl font-bold text-slate-950">{data.title}</Text>
          {data.courseTitle ? <Text className="mt-0.5 text-sm text-slate-500">{data.courseTitle}</Text> : null}
        </View>

        <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <InfoRow icon="clock" label={`${minutes} minute${minutes === 1 ? "" : "s"}`} />
          <InfoRow icon="award" label={`${data.totalMarks} marks`} />
          <InfoRow icon="repeat" label={`${data.attemptsUsed} of ${data.attemptsAllowed} attempts used`} />
        </View>

        <Text className="text-xs text-slate-500">
          Once you start, the timer cannot be paused. If you leave the app, your answers are saved automatically and you can resume where you left off
          until time runs out.
        </Text>

        {!data.canStart && data.reason ? (
          <View className="rounded-xl bg-warning-100 p-3">
            <Text className="text-sm text-warning-700">{data.reason}</Text>
          </View>
        ) : null}

        {start.isError ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{isNormalizedApiError(start.error) ? start.error.message : "Could not start this test."}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => start.mutate()}
          disabled={!data.canStart || start.isPending}
          className="mt-auto h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {start.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Start test</Text>}
        </Pressable>
      </View>
    </AppScreen>
  );
}

function InfoRow({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <Feather name={icon} size={16} color="#1d4ed8" />
      <Text className="text-sm text-slate-700">{label}</Text>
    </View>
  );
}
