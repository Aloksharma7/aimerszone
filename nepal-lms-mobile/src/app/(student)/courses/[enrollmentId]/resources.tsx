import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { downloadResource, fetchCourseResources } from "@/lib/data/course";
import type { CourseResource } from "@/types/lms";

export default function CourseResourcesScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const resources = useQuery({
    queryKey: ["student", "course", enrollmentId, "resources"],
    queryFn: () => fetchCourseResources(enrollmentId),
  });

  if (resources.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (resources.isError) {
    const message = isNormalizedApiError(resources.error) ? resources.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => resources.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <FlashList
        data={resources.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="px-5 py-1.5">
            <ResourceRow resource={item} />
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        refreshing={resources.isRefetching}
        onRefresh={() => resources.refetch()}
        ListEmptyComponent={
          <View className="mx-5 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">No downloadable resources have been released for this batch yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ResourceRow({ resource }: { resource: CourseResource }) {
  const download = useMutation({
    mutationFn: () => downloadResource(resource.id),
    onSuccess: (destination) => Linking.openURL(destination.url),
  });

  return (
    <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <Feather name="file-text" size={20} color="#1d4ed8" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
            {resource.title}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {resource.moduleTitle} · {resource.type} · {resource.size}
          </Text>
        </View>
        <Pressable
          onPress={() => download.mutate()}
          disabled={download.isPending}
          className="h-11 w-11 items-center justify-center rounded-xl bg-brand-50 active:bg-brand-100 disabled:opacity-60"
        >
          {download.isPending ? <ActivityIndicator size="small" color="#1d4ed8" /> : <Feather name="download" size={18} color="#1d4ed8" />}
        </Pressable>
      </View>
      {download.isError ? (
        <Text className="mt-2 text-xs text-danger-700">
          {isNormalizedApiError(download.error) ? download.error.message : "Could not download this file."}
        </Text>
      ) : null}
    </View>
  );
}
