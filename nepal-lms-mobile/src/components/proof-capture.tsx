import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

export type CapturedProof = { uri: string; name: string; type: string };

async function pick(source: "camera" | "gallery"): Promise<CapturedProof | null> {
  const permission =
    source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) return null;

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });

  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const extension = asset.uri.split(".").pop() ?? "jpg";

  return { uri: asset.uri, name: `payment-proof.${extension}`, type: asset.mimeType ?? `image/${extension}` };
}

/** Image capture — camera or gallery. Originally built for payment evidence, now reused anywhere a single image needs picking (e.g. a course thumbnail). */
export function ProofCapture({
  value,
  onChange,
  label = "Payment evidence",
}: {
  value: CapturedProof | null;
  onChange: (proof: CapturedProof | null) => void;
  label?: string;
}) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-semibold text-slate-700">{label}</Text>
      {value ? (
        <View className="gap-2">
          <Image source={{ uri: value.uri }} style={{ width: "100%", height: 180, borderRadius: 12 }} contentFit="cover" />
          <Pressable onPress={() => onChange(null)} className="h-10 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 active:bg-slate-100">
            <Feather name="x" size={14} color="#64748b" />
            <Text className="text-sm font-medium text-slate-700">Remove</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Pressable
            onPress={async () => onChange(await pick("camera"))}
            className="h-24 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white active:bg-slate-50"
          >
            <Feather name="camera" size={20} color="#1d4ed8" />
            <Text className="text-xs font-medium text-slate-600">Take photo</Text>
          </Pressable>
          <Pressable
            onPress={async () => onChange(await pick("gallery"))}
            className="h-24 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white active:bg-slate-50"
          >
            <Feather name="image" size={20} color="#1d4ed8" />
            <Text className="text-xs font-medium text-slate-600">Choose from gallery</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
