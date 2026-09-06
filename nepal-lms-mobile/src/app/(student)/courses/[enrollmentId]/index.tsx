import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/progress-bar";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseDetail } from "@/lib/data/course";

const navTiles = [
  { key: "syllabus", label: "Syllabus", icon: "list" as const },
  { key: "classes", label: "Classes", icon: "video" as const },
  { key: "recordings", label: "Recordings", icon: "play-circle" as const },
  { key: "resources", label: "Resources", icon: "download" as const },
  { key: "tests", label: "Tests", icon: "edit-3" as const },
  { key: "announcements", label: "Announcements", icon: "bell" as const },
];

export default function CourseOverviewScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const router = useRouter();
  const course = useQuery({
    queryKey: ["student", "course", enrollmentId],
    queryFn: () => fetchCourseDetail(enrollmentId),
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
        <Button label="Try again" onPress={() => course.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = course.data;

  return (
    <AppScreen edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-6 px-5 py-6">
        <View>
          <Text className="text-xl font-bold text-slate-950">{data.courseTitle}</Text>
          <Text className="mt-0.5 text-sm text-slate-500">{data.batchTitle}</Text>
        </View>

        <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
          <Text className="text-sm font-bold text-slate-900">Your progress</Text>
          <View className="mt-3 gap-3">
            <LabeledProgress label="Overall" percent={data.progress.overall} />
            <LabeledProgress label="Attendance" percent={data.progress.attendance} />
            <LabeledProgress label="Recordings" percent={data.progress.recordings} />
            <LabeledProgress label="Tests" percent={data.progress.tests} />
            <LabeledProgress label="Syllabus" percent={data.progress.syllabus} />
          </View>
        </View>

        <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
          <Text className="text-sm font-bold text-slate-900">Batch details</Text>
          <DetailRow icon="user" label="Teacher" value={data.teacherNames.join(", ") || "To be announced"} />
          <DetailRow icon="calendar" label="Schedule" value={data.scheduleSummary} />
          <DetailRow icon="clock" label="Access until" value={data.accessExpiry} />
        </View>

        <View className="flex-row flex-wrap gap-3">
          {navTiles.map((tile) => (
            <Pressable
              key={tile.key}
              onPress={() =>
                router.push({
                  pathname: `/(student)/courses/[enrollmentId]/${tile.key}` as never,
                  params: { enrollmentId },
                })
              }
              className="w-[47%] items-center gap-2 rounded-2xl border border-slate-100 bg-white shadow-sm py-5 active:bg-slate-50"
            >
              <Feather name={tile.icon} size={22} color="#1d4ed8" />
              <Text className="text-sm font-semibold text-slate-900">{tile.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function LabeledProgress({ label, percent }: { label: string; percent: number }) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-slate-500">{label}</Text>
        <Text className="text-xs font-semibold text-slate-700">{percent}%</Text>
      </View>
      <ProgressBar percent={percent} />
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Feather name={icon} size={16} color="#1d4ed8" />
      <View className="flex-1">
        <Text className="text-xs text-slate-500">{label}</Text>
        <Text className="text-sm font-medium text-slate-900">{value}</Text>
      </View>
    </View>
  );
}
