import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CourseCard } from "@/components/course-card";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourses } from "@/lib/data/student";

export default function StudentCourses() {
  const router = useRouter();
  const courses = useQuery({ queryKey: ["student", "courses"], queryFn: fetchCourses });

  if (courses.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton />
      </SafeAreaView>
    );
  }

  if (courses.isError) {
    const message = isNormalizedApiError(courses.error) ? courses.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => courses.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-950">My courses</Text>
          <Pressable
            onPress={() => router.push("/(student)/courses/explore")}
            className="h-10 flex-row items-center gap-1.5 rounded-full bg-brand-700 px-3.5 active:bg-brand-800"
          >
            <Feather name="compass" size={14} color="#fff" />
            <Text className="text-xs font-bold text-white">Explore</Text>
          </Pressable>
        </View>
      </View>
      <FlatList
        data={courses.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CourseCard enrollment={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={courses.isRefetching}
        onRefresh={() => courses.refetch()}
        ListEmptyComponent={
          <View className="gap-3">
            <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
              <Text className="text-sm text-slate-500">You don&apos;t have any active courses yet.</Text>
            </View>
            <Pressable
              onPress={() => router.push("/(student)/courses/explore")}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
            >
              <Feather name="compass" size={16} color="#fff" />
              <Text className="text-base font-bold text-white">Explore courses</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}
