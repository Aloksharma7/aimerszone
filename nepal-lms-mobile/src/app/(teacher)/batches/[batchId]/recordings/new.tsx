import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
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
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View className="rounded-2xl bg-info-100 p-3">
          <Text className="text-xs text-info-700">
            Upload the recording to the institution&apos;s YouTube channel as Unlisted first, then paste its video id here.
          </Text>
        </View>

        <TextField label="Title" value={title} onChangeText={setTitle} editable={!create.isPending} />

        <TextField
          label="YouTube video ID"
          value={videoId}
          onChangeText={setVideoId}
          autoCapitalize="none"
          placeholder="e.g. dQw4w9WgXcQ"
          editable={!create.isPending}
        />

        <TextField label="Module (optional)" value={moduleTitle} onChangeText={setModuleTitle} editable={!create.isPending} />

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

        <Button
          label="Add recording"
          loading={create.isPending}
          disabled={!canSubmit}
          size="lg"
          onPress={() => {
            setError(null);
            create.mutate();
          }}
        />
        {warning ? <Button label="Done" variant="secondary" size="lg" onPress={() => router.back()} /> : null}
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
