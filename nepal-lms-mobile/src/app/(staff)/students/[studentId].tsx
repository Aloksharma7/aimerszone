import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchStaffStudentDetail } from "@/lib/data/staff";

export default function StaffStudentDetailScreen() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const router = useRouter();
  const student = useQuery({ queryKey: ["staff", "student", studentId], queryFn: () => fetchStaffStudentDetail(studentId) });

  if (student.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (student.isError) {
    const message = isNormalizedApiError(student.error) ? student.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => student.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = student.data;

  return (
    <AppScreen edges={["bottom"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <View className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <View className="flex-row items-start justify-between gap-2">
            <Text className="flex-1 text-lg font-bold text-slate-950">{data.name}</Text>
            <StatusBadge label={data.status} tone={data.status === "active" ? "success" : "neutral"} />
          </View>
          {data.studentCode ? <Text className="mt-1 text-xs text-slate-500">{data.studentCode}</Text> : null}
          <DetailRow icon="phone" value={data.mobile} />
          {data.email ? <DetailRow icon="mail" value={data.email} /> : null}
          {data.currentCourseTitle ? <DetailRow icon="book-open" value={data.currentCourseTitle} /> : null}
          {data.joinedAt ? <DetailRow icon="calendar" value={`Joined ${data.joinedAt}`} /> : null}
        </View>

        <Pressable
          onPress={() => router.push({ pathname: "/(staff)/students/enroll", params: { studentId: data.id } })}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800"
        >
          <Feather name="book-open" size={16} color="#fff" />
          <Text className="text-base font-bold text-white">Enroll in a course</Text>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

function DetailRow({ icon, value }: { icon: keyof typeof Feather.glyphMap; value: string }) {
  return (
    <View className="mt-2 flex-row items-center gap-2">
      <Feather name={icon} size={14} color="#64748b" />
      <Text className="text-sm text-slate-700">{value}</Text>
    </View>
  );
}
