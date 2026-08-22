import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { uploadTeacherResource } from "@/lib/data/teacher";

type PickedFile = { uri: string; name: string; type: string };

export default function NewResourceScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [moduleTitle, setModuleTitle] = useState("");
  const [releaseNow, setReleaseNow] = useState(true);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/pdf" });
    if (!title) setTitle(asset.name.replace(/\.pdf$/i, ""));
  }

  const upload = useMutation({
    mutationFn: () => uploadTeacherResource({ batchId, title, moduleTitle: moduleTitle || undefined, releaseNow, file: file! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId, "resources"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId] });
      router.back();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not upload this file."),
  });

  const canSubmit = Boolean(file && title.trim().length >= 2 && !upload.isPending);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <Pressable onPress={pickFile} className="h-24 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white active:bg-slate-50">
          <Feather name={file ? "file-text" : "upload"} size={22} color="#1d4ed8" />
          <Text className="text-sm font-medium text-slate-700">{file ? file.name : "Choose a PDF"}</Text>
        </Pressable>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Title</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={title}
            onChangeText={setTitle}
            editable={!upload.isPending}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Module (optional)</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={moduleTitle}
            onChangeText={setModuleTitle}
            editable={!upload.isPending}
          />
        </View>

        <Pressable onPress={() => setReleaseNow((value) => !value)} className="flex-row items-center gap-3">
          <Feather name={releaseNow ? "check-square" : "square"} size={20} color={releaseNow ? "#1d4ed8" : "#94a3b8"} />
          <Text className="text-sm text-slate-700">Release to students immediately</Text>
        </Pressable>

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setError(null);
            upload.mutate();
          }}
          disabled={!canSubmit}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {upload.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Upload</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
