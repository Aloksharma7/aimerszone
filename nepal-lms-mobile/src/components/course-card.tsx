import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import { ProgressBar } from "@/components/progress-bar";
import type { EnrollmentSummary } from "@/types/lms";

export function CourseCard({ enrollment }: { enrollment: EnrollmentSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(student)/courses/[enrollmentId]", params: { enrollmentId: enrollment.id } })}
      className="flex-row gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 active:bg-slate-50"
    >
      {enrollment.thumbnailUrl ? (
        <Image
          source={{ uri: enrollment.thumbnailUrl }}
          placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
          style={{ width: 56, height: 56, borderRadius: 12 }}
          contentFit="cover"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-xl bg-brand-100">
          <Feather name="book-open" size={20} color="#1d4ed8" />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
          {enrollment.courseTitle}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {enrollment.batchTitle}
        </Text>
        <ProgressBar percent={enrollment.progressPercent} />
        <Text className="mt-1.5 text-xs font-medium text-brand-700">{enrollment.nextAction}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#94a3b8" style={{ alignSelf: "center" }} />
    </Pressable>
  );
}
