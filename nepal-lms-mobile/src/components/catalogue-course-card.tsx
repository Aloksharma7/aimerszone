import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import type { CatalogueCourse } from "@/types/lms";

export function CatalogueCourseCard({ course }: { course: CatalogueCourse }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(student)/courses/explore/[slug]", params: { slug: course.slug } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row gap-3">
        {course.thumbnailUrl ? (
          <Image
            source={{ uri: course.thumbnailUrl }}
            placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
            style={{ width: 64, height: 64, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View className="h-16 w-16 items-center justify-center rounded-xl bg-brand-100">
            <Feather name="book-open" size={22} color="#1d4ed8" />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
            {course.title}
          </Text>
          {course.categoryName ? <Text className="mt-0.5 text-xs text-slate-500">{course.categoryName}</Text> : null}
          <Text className="mt-1 text-sm font-bold text-brand-700">{course.accessType === "free" ? "Free" : `Rs. ${course.startingPriceNpr.toLocaleString("en-IN")}`}</Text>
        </View>
      </View>
    </Pressable>
  );
}
