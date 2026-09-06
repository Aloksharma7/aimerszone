import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

import { LiveBadge } from "@/components/live-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { startClassSession } from "@/lib/data/teacher";
import type { TeacherSession } from "@/types/lms";

export function TeacherSessionCard({ session, queryKeyToInvalidate }: { session: TeacherSession; queryKeyToInvalidate: readonly unknown[] }) {
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: () => startClassSession(session.id),
    onSuccess: async (destination) => {
      await queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
      await Linking.openURL(destination.redirectUrl);
    },
  });

  return (
    <View className="rounded-2xl bg-brand-900 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wide text-brand-100">Next class</Text>
        {session.startAvailable ? <LiveBadge /> : null}
      </View>
      <Text className="mt-1 text-lg font-bold text-white">{session.title}</Text>
      <Text className="mt-0.5 text-sm text-brand-100">
        {session.courseTitle} · {session.batchTitle}
      </Text>
      <Text className="mt-0.5 text-sm text-brand-100">
        {session.date}, {session.timeRange} · {session.studentsCount} student{session.studentsCount === 1 ? "" : "s"}
      </Text>

      {session.canStart ? (
        <Pressable
          onPress={() => start.mutate()}
          disabled={!session.startAvailable || start.isPending}
          className="mt-4 h-11 flex-row items-center justify-center rounded-xl bg-white active:opacity-80 disabled:opacity-50"
        >
          {start.isPending ? (
            <ActivityIndicator color="#172554" />
          ) : (
            <Text className="text-sm font-bold text-brand-900">{session.startAvailable ? "Start class" : "Opens 30 min before class"}</Text>
          )}
        </Pressable>
      ) : null}
      {start.isError ? (
        <Text className="mt-2 text-xs text-danger-100">{isNormalizedApiError(start.error) ? start.error.message : "Could not start the class."}</Text>
      ) : null}
    </View>
  );
}
