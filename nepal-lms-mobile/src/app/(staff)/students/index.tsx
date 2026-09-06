import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { StaffStudentRow } from "@/components/staff-student-row";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchStaffStudentsPage } from "@/lib/data/staff";

export default function StaffStudentsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const students = useInfiniteQuery({
    queryKey: ["staff", "students", debounced],
    queryFn: ({ pageParam }) => fetchStaffStudentsPage(pageParam, debounced || undefined),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
  });

  const items = students.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <ScreenHeader
          title="Students"
          right={
            <Pressable
              onPress={() => router.push("/(staff)/students/new")}
              className="h-11 w-11 items-center justify-center rounded-full bg-brand-700 active:bg-brand-800"
            >
              <Feather name="user-plus" size={18} color="#fff" />
            </Pressable>
          }
        />
        <View className="h-11 flex-row items-center gap-2 rounded-xl border border-slate-300 bg-white px-3">
          <Feather name="search" size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 text-base text-slate-900"
            placeholder="Search by name, mobile, or code"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {students.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1d4ed8" />
        </View>
      ) : students.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(students.error) ? students.error.message : "Something went wrong."}</Text>
          <Pressable onPress={() => students.refetch()} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
            <Text className="text-sm font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="px-5 py-1.5">
              <StaffStudentRow student={item} />
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          refreshing={students.isRefetching && !students.isFetchingNextPage}
          onRefresh={() => students.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (students.hasNextPage && !students.isFetchingNextPage) students.fetchNextPage();
          }}
          ListEmptyComponent={
            <View className="mx-5">
              <EmptyState icon="search" title="No matches" description="Try a different name or mobile number." />
            </View>
          }
          ListFooterComponent={students.isFetchingNextPage ? <ActivityIndicator className="py-4" color="#1d4ed8" /> : null}
        />
      )}
    </AppScreen>
  );
}
