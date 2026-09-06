import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherRecordings } from "@/lib/data/teacher";
import type { TeacherRecording } from "@/types/lms";

export default function TeacherRecordingsScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const recordings = useQuery({ queryKey: ["teacher", "batch", batchId, "recordings"], queryFn: () => fetchTeacherRecordings(batchId) });

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
        <Button label="Try again" onPress={() => recordings.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <FlatList
        data={recordings.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecordingRow recording={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/recordings/new", params: { batchId } })}
            className="mb-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">Add recording</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <EmptyState icon="play-circle" title="No recordings yet" description="Upload a recording to make it available to students in this batch." />
        }
      />
    </AppScreen>
  );
}

function RecordingRow({ recording }: { recording: TeacherRecording }) {
  return (
    <View className="flex-row gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      {recording.thumbnailUrl ? (
        <Image
          source={{ uri: recording.thumbnailUrl }}
          placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-brand-100">
          <Feather name="play-circle" size={20} color="#1d4ed8" />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
          {recording.title}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">
          {recording.moduleTitle || "No module"} · {recording.duration}
        </Text>
        <Text className={`mt-1 text-xs font-medium ${recording.released ? "text-success-700" : "text-warning-700"}`}>
          {recording.state === "processing" ? "Processing" : recording.released ? "Released to students" : "Not released yet"}
        </Text>
      </View>
    </View>
  );
}
