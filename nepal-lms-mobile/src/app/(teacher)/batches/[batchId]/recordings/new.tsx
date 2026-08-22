import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { createTeacherRecording } from "@/lib/data/teacher";

export default function NewRecordingScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [videoId, setVideoId] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [releaseNow, setReleaseNow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createTeacherRecording({ batchId, title, youtubeVideoId: videoId.trim(), moduleTitle: moduleTitle || undefined, releaseNow }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId, "recordings"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId] });
      if (result.warning) {
        setWarning(result.warning);
        return;
      }
      router.back();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not add this recording."),
  });

  const canSubmit = Boolean(title.trim().length >= 3 && /^[A-Za-z0-9_-]{11}$/.test(videoId.trim()) && !create.isPending);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View className="rounded-2xl bg-info-100 p-3">
          <Text className="text-xs text-info-700">
            Upload the recording to the institution&apos;s YouTube channel as Unlisted first, then paste its video id here.
          </Text>
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Title</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={title}
            onChangeText={setTitle}
            editable={!create.isPending}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">YouTube video ID</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={videoId}
            onChangeText={setVideoId}
            autoCapitalize="none"
            placeholder="e.g. dQw4w9WgXcQ"
            editable={!create.isPending}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Module (optional)</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={moduleTitle}
            onChangeText={setModuleTitle}
            editable={!create.isPending}
          />
        </View>

        <Pressable onPress={() => setReleaseNow((value) => !value)} className="flex-row items-center gap-3">
          <Feather name={releaseNow ? "check-square" : "square"} size={20} color={releaseNow ? "#1d4ed8" : "#94a3b8"} />
          <Text className="text-sm text-slate-700">Release to students immediately</Text>
        </Pressable>

        {warning ? (
          <View className="rounded-xl bg-warning-100 p-3">
            <Text className="text-sm text-warning-700">{warning}</Text>
          </View>
        ) : null}
        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          disabled={!canSubmit}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Add recording</Text>}
        </Pressable>
        {warning ? (
          <Pressable onPress={() => router.back()} className="h-12 flex-row items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100">
            <Text className="text-base font-bold text-slate-700">Done</Text>
          </Pressable>
        ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
