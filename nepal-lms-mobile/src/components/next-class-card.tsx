import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";

import { LiveBadge } from "@/components/live-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { joinClassSession } from "@/lib/data/student";
import type { LiveSession } from "@/types/lms";

export function NextClassCard({ session }: { session: LiveSession }) {
  const queryClient = useQueryClient();
  const join = useMutation({
    mutationFn: () => joinClassSession(session.id),
    onSuccess: async (destination) => {
      await queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
      await Linking.openURL(destination.url);
    },
  });

  return (
    <View className="rounded-2xl bg-brand-900 p-5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wide text-brand-100">Next class</Text>
        {session.joinAvailable ? <LiveBadge /> : null}
      </View>
      <Text className="mt-1 text-lg font-bold text-white">{session.topic}</Text>
      <Text className="mt-0.5 text-sm text-brand-100">
        {session.courseTitle} · {session.batchTitle}
      </Text>
      <Text className="mt-0.5 text-sm text-brand-100">
        {session.date}, {session.timeRange} · {session.teacherName}
      </Text>

      <Pressable
        onPress={() => join.mutate()}
        disabled={!session.joinAvailable || join.isPending}
        className="mt-4 h-11 flex-row items-center justify-center rounded-xl bg-white active:opacity-80 disabled:opacity-50"
      >
        {join.isPending ? (
          <ActivityIndicator color="#172554" />
        ) : (
          <Text className="text-sm font-bold text-brand-900">{session.joinAvailable ? "Join class" : session.actionReason || "Not open yet"}</Text>
        )}
      </Pressable>
      {join.isError ? (
        <Text className="mt-2 text-xs text-danger-100">
          {isNormalizedApiError(join.error) ? join.error.message : "Could not open the class link."}
        </Text>
      ) : null}
    </View>
  );
}
