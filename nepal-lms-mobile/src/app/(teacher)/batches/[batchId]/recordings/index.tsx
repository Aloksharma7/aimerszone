import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
        <Pressable onPress={() => recordings.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
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
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No recordings have been added yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
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
