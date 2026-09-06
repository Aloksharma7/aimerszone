import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { ProgressBar } from "@/components/progress-bar";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchCourseSyllabus, setLessonComplete } from "@/lib/data/course";
import type { SyllabusLesson, SyllabusModule } from "@/types/lms";

export default function CourseSyllabusScreen() {
  const { enrollmentId } = useLocalSearchParams<{ enrollmentId: string }>();
  const queryClient = useQueryClient();
  const queryKey = ["student", "course", enrollmentId, "syllabus"];
  const syllabus = useQuery({ queryKey, queryFn: () => fetchCourseSyllabus(enrollmentId) });

  const toggle = useMutation({
    mutationFn: ({ lessonId, completed }: { lessonId: string; completed: boolean }) => setLessonComplete(enrollmentId, lessonId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["student", "course", enrollmentId] });
    },
  });

  if (syllabus.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (syllabus.isError) {
    const message = isNormalizedApiError(syllabus.error) ? syllabus.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => syllabus.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        {syllabus.data.length === 0 ? (
          <EmptyState icon="list" title="Syllabus not published" description="Your teacher hasn't published a syllabus for this course yet." />
        ) : (
          syllabus.data.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              pendingLessonId={toggle.isPending ? toggle.variables?.lessonId : undefined}
              onToggle={(lesson) => toggle.mutate({ lessonId: lesson.id, completed: !lesson.completed })}
            />
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

function ModuleCard({
  module,
  pendingLessonId,
  onToggle,
}: {
  module: SyllabusModule;
  pendingLessonId: string | undefined;
  onToggle: (lesson: SyllabusLesson) => void;
}) {
  return (
    <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 text-sm font-bold text-slate-900">{module.title}</Text>
        <Text className="text-xs font-semibold text-brand-700">{module.progressPercent}%</Text>
      </View>
      <ProgressBar percent={module.progressPercent} />

      <View className="mt-3 gap-1">
        {module.lessons.map((lesson) => (
          <Pressable
            key={lesson.id}
            onPress={() => onToggle(lesson)}
            disabled={pendingLessonId === lesson.id}
            className="flex-row items-center gap-3 rounded-xl px-1 py-2.5 active:bg-slate-50"
          >
            {pendingLessonId === lesson.id ? (
              <ActivityIndicator size="small" color="#1d4ed8" />
            ) : (
              <Feather name={lesson.completed ? "check-circle" : "circle"} size={20} color={lesson.completed ? "#15803d" : "#cbd5e1"} />
            )}
            <View className="flex-1">
              <Text className={`text-sm ${lesson.completed ? "text-slate-500 line-through" : "font-medium text-slate-900"}`}>{lesson.title}</Text>
              <Text className="text-xs text-slate-400">{lesson.type}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
