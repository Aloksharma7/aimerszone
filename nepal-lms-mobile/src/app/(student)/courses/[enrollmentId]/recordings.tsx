import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProgressBar } from "@/components/progress-bar";
import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseRecordings, playRecording } from "@/lib/data/course";
import type { CourseRecording } from "@/types/lms";

export default function CourseRecordingsScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const recordings = useQuery({
    queryKey: ["student", "course", enrollmentId, "recordings"],
    queryFn: () => fetchCourseRecordings(enrollmentId),
  });

  if (recordings.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (recordings.isError) {
    const message = isNormalizedApiError(recordings.error) ? recordings.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => recordings.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlashList
        data={recordings.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <RecordingRow recording={item} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        refreshing={recordings.isRefetching}
        onRefresh={() => recordings.refetch()}
        ListEmptyComponent={
          <View className="mx-5 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">No recordings have been released for this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function RecordingRow({ recording }: { recording: CourseRecording }) {
  const play = useMutation({
    mutationFn: () => playRecording(recording.id),
    onSuccess: (destination) => Linking.openURL(destination.url),
  });

  const disabled = recording.state === "Processing" || play.isPending;

  return (
    <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
      <Pressable onPress={() => play.mutate()} disabled={disabled} className="flex-row gap-3 active:opacity-70 disabled:opacity-60">
        {recording.thumbnailUrl ? (
          <Image
            source={{ uri: recording.thumbnailUrl }}
            placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
            style={{ width: 64, height: 64, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-xl bg-brand-100">
            {play.isPending ? <ActivityIndicator color="#1d4ed8" /> : <Feather name="play-circle" size={24} color="#1d4ed8" />}
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
            {recording.title}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {recording.moduleTitle} · {recording.duration}
          </Text>
          <Text className="text-xs text-slate-400">{recording.teacherName}</Text>
          {recording.state === "Processing" ? (
            <Text className="mt-1 text-xs font-medium text-warning-700">Processing — check back soon</Text>
          ) : (
            <ProgressBar percent={recording.progressPercent} />
          )}
        </View>
      </Pressable>
      {play.isError ? (
        <Text className="mt-2 text-xs text-danger-700">{isNormalizedApiError(play.error) ? play.error.message : "Could not open this recording."}</Text>
      ) : null}
    </View>
  );
}
