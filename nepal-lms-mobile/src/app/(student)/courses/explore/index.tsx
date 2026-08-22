import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CatalogueCourseCard } from "@/components/catalogue-course-card";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCataloguePage } from "@/lib/data/catalogue";

export default function ExploreCoursesScreen() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const courses = useInfiniteQuery({
    queryKey: ["catalogue", debounced],
    queryFn: ({ pageParam }) => fetchCataloguePage(pageParam, debounced || undefined),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = courses.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <View className="px-5 pb-3 pt-4">
        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput className="flex-1 text-base text-slate-900" placeholder="Search courses" value={search} onChangeText={setSearch} autoCapitalize="none" />
        </View>
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
              <CatalogueCourseCard course={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshing={courses.isRefetching && !courses.isFetchingNextPage}
          onRefresh={() => courses.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (courses.hasNextPage && !courses.isFetchingNextPage) courses.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <Text className="text-sm text-slate-500">No courses match this search.</Text>
            </View>
          }
          ListFooterComponent={courses.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </SafeAreaView>
  );
}
