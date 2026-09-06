import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { CourseCard } from "@/components/course-card";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourses } from "@/lib/data/student";

export default function StudentCourses() {
  const router = useRouter();
  const courses = useQuery({ queryKey: ["student", "courses"], queryFn: fetchCourses });

  if (courses.isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton />
      </AppScreen>
    );
  }

  if (courses.isError) {
    const message = isNormalizedApiError(courses.error) ? courses.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => courses.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <ScreenHeader
          title="My courses"
          right={
            <Pressable
              onPress={() => router.push("/(student)/courses/explore")}
              className="h-10 flex-row items-center gap-1.5 rounded-full bg-brand-700 px-3.5 active:bg-brand-800"
            >
              <Feather name="compass" size={14} color="#fff" />
              <Text className="text-xs font-bold text-white">Explore</Text>
            </Pressable>
          }
        />
      </View>
      <FlatList
        data={courses.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CourseCard enrollment={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        refreshing={courses.isRefetching}
        onRefresh={() => courses.refetch()}
        ListEmptyComponent={
          <View className="px-5">
            <EmptyState icon="book-open" title="No active courses" description="Explore the catalogue and enroll in a course to get started." actionLabel="Explore courses" onAction={() => router.push("/(student)/courses/explore")} />
          </View>
        }
      />
    </AppScreen>
  );
}
