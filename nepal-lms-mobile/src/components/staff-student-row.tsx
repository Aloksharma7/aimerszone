import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { StaffStudent } from "@/types/lms";

export function StaffStudentRow({ student }: { student: StaffStudent }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(staff)/students/[studentId]", params: { studentId: student.id } })}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-100">
        <Feather name="user" size={16} color="#1d4ed8" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
          {student.name}
        </Text>
        <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
          {student.mobile}
          {student.currentCourseTitle ? ` · ${student.currentCourseTitle}` : ""}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color="#94a3b8" />
    </Pressable>
  );
}
