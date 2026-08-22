import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { enrollInFreeBatch, fetchCatalogueCourseDetail } from "@/lib/data/catalogue";
import type { CatalogueBatch } from "@/types/lms";

export default function CourseCatalogueDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const course = useQuery({ queryKey: ["catalogue", "course", slug], queryFn: () => fetchCatalogueCourseDetail(slug) });
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const enrollFree = useMutation({
    mutationFn: (batchId: string) => enrollInFreeBatch(batchId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["student", "courses"] });
      queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
      Alert.alert("You're enrolled!", `${result.courseTitle ?? "The course"} is now in My Courses.`, [
        { text: "OK", onPress: () => router.push("/(student)/courses") },
      ]);
    },
  });

  if (course.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (course.isError) {
    const message = isNormalizedApiError(course.error) ? course.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => course.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = course.data;
  const selectedBatch = data.batches.find((batch) => batch.id === selectedBatchId) ?? data.batches[0] ?? null;

  function handleEnroll() {
    if (!selectedBatch) return;

    if (data.accessType === "free") {
      enrollFree.mutate(selectedBatch.id);
      return;
    }

    router.push({ pathname: "/(student)/courses/explore/[slug]/pay", params: { slug, batchId: selectedBatch.id } });
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        {data.thumbnailUrl ? (
          <Image
            source={{ uri: data.thumbnailUrl }}
            placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
            style={{ width: "100%", height: 160, borderRadius: 16 }}
            contentFit="cover"
          />
        ) : null}

        <View>
          <Text className="text-xl font-bold text-slate-950">{data.title}</Text>
          {data.categoryName ? <Text className="mt-0.5 text-sm text-slate-500">{data.categoryName}</Text> : null}
          {data.teacherName ? <Text className="mt-0.5 text-sm text-slate-500">Taught by {data.teacherName}</Text> : null}
        </View>

        {data.shortDescription ? <Text className="text-sm leading-5 text-slate-700">{data.shortDescription}</Text> : null}

        {data.features.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {data.features.map((feature) => (
              <View key={feature} className="rounded-full bg-brand-100 px-3 py-1.5">
                <Text className="text-xs font-medium text-brand-700">{feature}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {data.batches.length > 0 ? (
          <View className="gap-2">
            <Text className="text-sm font-bold text-slate-900">Choose a batch</Text>
            {data.batches.map((batch) => (
              <BatchOption key={batch.id} batch={batch} selected={selectedBatch?.id === batch.id} onPress={() => setSelectedBatchId(batch.id)} />
            ))}
          </View>
        ) : (
          <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <Text className="text-sm text-slate-500">No batches are open for enrollment right now.</Text>
          </View>
        )}

        {enrollFree.isError ? (
          <Text className="text-center text-xs text-danger-700">
            {isNormalizedApiError(enrollFree.error) ? enrollFree.error.message : "Could not complete enrollment."}
          </Text>
        ) : null}

        {selectedBatch ? (
          <Pressable
            onPress={handleEnroll}
            disabled={enrollFree.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {enrollFree.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-circle" size={16} color="#fff" />
                <Text className="text-base font-bold text-white">
                  {data.accessType === "free" ? "Enroll for free" : `Enroll — Rs. ${selectedBatch.priceNpr.toLocaleString("en-IN")}`}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BatchOption({ batch, selected, onPress }: { batch: CatalogueBatch; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-2xl border p-4 ${selected ? "border-brand-700 bg-brand-50" : "border-slate-100 bg-white shadow-sm"}`}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-slate-900">{batch.title}</Text>
        <Feather name={selected ? "check-circle" : "circle"} size={18} color={selected ? "#1d4ed8" : "#cbd5e1"} />
      </View>
      <Text className="mt-0.5 text-xs text-slate-500">{batch.scheduleSummary}</Text>
      <Text className="mt-0.5 text-xs text-slate-500">
        Starts {batch.startDate} · Access until {batch.accessUntil}
      </Text>
      {batch.teacherNames.length > 0 ? <Text className="mt-0.5 text-xs text-slate-500">{batch.teacherNames.join(", ")}</Text> : null}
    </Pressable>
  );
}
