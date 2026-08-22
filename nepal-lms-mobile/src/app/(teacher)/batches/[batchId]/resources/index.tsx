import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchTeacherResources } from "@/lib/data/teacher";
import type { TeacherResource } from "@/types/lms";

export default function TeacherResourcesScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const resources = useQuery({ queryKey: ["teacher", "batch", batchId, "resources"], queryFn: () => fetchTeacherResources(batchId) });

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
      <FlatList
        data={resources.data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ResourceRow resource={item} />}
        contentContainerClassName="gap-3 px-5 py-5"
        ListHeaderComponent={
          <Pressable
            onPress={() => router.push({ pathname: "/(teacher)/batches/[batchId]/resources/new", params: { batchId } })}
            className="mb-3 h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Feather name="upload" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">Upload resource</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No resources have been uploaded yet.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ResourceRow({ resource }: { resource: TeacherResource }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
        <Feather name="file-text" size={20} color="#1d4ed8" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={2}>
          {resource.title}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500">
          {resource.moduleTitle || "No module"} · {resource.fileType} · {resource.size}
        </Text>
        <Text className={`mt-1 text-xs font-medium ${resource.released ? "text-success-700" : "text-warning-700"}`}>
          {resource.released ? `Released · ${resource.downloadCount} downloads` : "Not released yet"}
        </Text>
      </View>
    </View>
  );
}
