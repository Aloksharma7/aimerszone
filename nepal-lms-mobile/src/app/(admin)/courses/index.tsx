import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAdminCoursesPage } from "@/lib/data/admin";
import type { AdminCourseSummary } from "@/types/lms";

const filters = [
  { value: undefined, label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

export default function AdminCoursesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const courses = useInfiniteQuery({
    queryKey: ["admin", "courses", debounced, status],
    queryFn: ({ pageParam }) => fetchAdminCoursesPage(pageParam, debounced || undefined, status),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = courses.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-slate-950">Courses</Text>
          <Pressable
            onPress={() => router.push("/(admin)/courses/new")}
            className="h-10 flex-row items-center gap-1.5 rounded-xl bg-brand-700 px-3.5 active:bg-brand-800"
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">New</Text>
          </Pressable>
        </View>

        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput className="flex-1 text-base text-slate-900" placeholder="Search courses" value={search} onChangeText={setSearch} autoCapitalize="none" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {filters.map((filter) => {
              const selected = status === filter.value;
              return (
                <Pressable
                  key={filter.label}
                  onPress={() => setStatus(filter.value)}
                  className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                >
                  <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {courses.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : courses.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(courses.error) ? courses.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => courses.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <CourseRow course={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={courses.isRefetching && !courses.isFetchingNextPage}
          onRefresh={() => courses.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (courses.hasNextPage && !courses.isFetchingNextPage) courses.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5">
              <EmptyState icon="search" title="No matches" description="Try a different search term." />
            </View>
          }
          ListFooterComponent={courses.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </AppScreen>
  );
}

function CourseRow({ course }: { course: AdminCourseSummary }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(admin)/courses/[courseId]", params: { courseId: course.id } })}
      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900" numberOfLines={1}>
          {course.title}
        </Text>
        <StatusBadge label={course.published ? "Published" : "Draft"} tone={course.published ? "success" : "neutral"} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
        {course.code} · {course.categoryName ?? "No category"}
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-sm font-bold text-slate-900">
          {course.accessType === "free" ? "Free" : `Rs. ${(course.startingPriceNpr ?? 0).toLocaleString("en-IN")}`}
        </Text>
        <Text className="text-xs text-slate-400">{course.availableBatches ?? 0} open batch{course.availableBatches === 1 ? "" : "es"}</Text>
      </View>
    </Pressable>
  );
}
