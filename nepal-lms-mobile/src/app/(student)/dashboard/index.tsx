import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnnouncementCard } from "@/components/announcement-card";
import { CourseCard } from "@/components/course-card";
import { NextClassCard } from "@/components/next-class-card";
import { ProgressBar } from "@/components/progress-bar";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { DrawerMenuButton } from "@/components/side-drawer";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchDashboard, markAnnouncementRead } from "@/lib/data/student";

export default function StudentDashboard() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const dashboard = useQuery({ queryKey: ["student", "dashboard"], queryFn: fetchDashboard });
  const markRead = useMutation({
    mutationFn: (announcementId: string) => markAnnouncementRead(announcementId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] }),
  });

  if (dashboard.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton count={3} />
      </SafeAreaView>
    );
  }

  if (dashboard.isError) {
    const message = isNormalizedApiError(dashboard.error) ? dashboard.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => dashboard.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = dashboard.data;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-6"
        refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-row items-start gap-2">
            <DrawerMenuButton />
            <View>
              <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">Student portal</Text>
              <Text className="mt-1 text-2xl font-bold text-slate-950">{user ? `Hi, ${user.name.split(" ")[0]}` : "Welcome back"}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push("/(student)/dashboard/notifications")}
            className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm active:bg-slate-100"
          >
            <Feather name="bell" size={18} color="#1d4ed8" />
            {data.announcements.some((item) => !item.read) ? (
              <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger-700" />
            ) : null}
          </Pressable>
        </View>

        {data.paymentReviewCount > 0 ? (
          <Pressable
            onPress={() => router.push("/(student)/payments")}
            className="flex-row items-center gap-3 rounded-2xl bg-warning-100 px-4 py-3 active:opacity-80"
          >
            <Feather name="clock" size={18} color="#a16207" />
            <Text className="flex-1 text-sm font-medium text-warning-700">
              {data.paymentReviewCount} payment{data.paymentReviewCount === 1 ? "" : "s"} under review.
            </Text>
          </Pressable>
        ) : null}

        {data.nextClass ? <NextClassCard session={data.nextClass} /> : null}

        {data.activeCourses.length > 0 ? (
          <Section title="My courses">
            <View className="gap-3">
              {data.activeCourses.map((enrollment) => (
                <CourseCard key={enrollment.id} enrollment={enrollment} />
              ))}
            </View>
          </Section>
        ) : (
          <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
            <Text className="text-sm text-slate-500">You don&apos;t have any active courses yet.</Text>
          </View>
        )}

        {data.continueRecording ? (
          <Section title="Continue watching">
            <View className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
              <Text className="text-sm font-semibold text-slate-900">{data.continueRecording.title}</Text>
              <Text className="mt-0.5 text-xs text-slate-500">{data.continueRecording.courseTitle}</Text>
              <ProgressBar percent={data.continueRecording.progressPercent} />
            </View>
          </Section>
        ) : null}

        {data.upcomingTests.length > 0 ? (
          <Section title="Upcoming tests">
            <View className="gap-2">
              {data.upcomingTests.map((test) => (
                <View key={test.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4">
                  <Text className="text-sm font-semibold text-slate-900">{test.title}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">{test.courseTitle}</Text>
                  <Text className="mt-1.5 text-xs font-medium text-brand-700">{test.availability}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {data.announcements.length > 0 ? (
          <Section title="Announcements">
            <View className="gap-2">
              {data.announcements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onPress={announcement.read ? undefined : () => markRead.mutate(announcement.id)}
                />
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
