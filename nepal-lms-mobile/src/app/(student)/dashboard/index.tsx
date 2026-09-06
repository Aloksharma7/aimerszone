import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/button";
import { AnnouncementCard } from "@/components/announcement-card";
import { CourseCard } from "@/components/course-card";
import { MetricTile } from "@/components/metric-tile";
import { NextClassCard } from "@/components/next-class-card";
import { ProgressBar } from "@/components/progress-bar";
import { ScreenHeader } from "@/components/screen-header";
import { Section } from "@/components/section";
import { ListSkeleton } from "@/components/skeleton";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchDashboard, markAnnouncementRead } from "@/lib/data/student";
import { timeOfDayGreeting } from "@/lib/greeting";

/** Staggers each dashboard block's entrance instead of everything popping in at once. */
function reveal(index: number) {
  return FadeInDown.duration(320).delay(index * 60);
}

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
      <AppScreen edges={["top"]}>
        <ListSkeleton count={3} />
      </AppScreen>
    );
  }

  if (dashboard.isError) {
    const message = isNormalizedApiError(dashboard.error) ? dashboard.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button label="Try again" onPress={() => dashboard.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const data = dashboard.data;
  const unreadCount = data.announcements.filter((item) => !item.read).length;

  return (
    <AppScreen edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-6"
        refreshControl={<RefreshControl refreshing={dashboard.isRefetching} onRefresh={() => dashboard.refetch()} />}
      >
        <ScreenHeader
          eyebrow="Student portal"
          title={user ? timeOfDayGreeting(user.name.split(" ")[0]) : "Welcome back"}
          right={
            <Pressable
              onPress={() => router.push("/(student)/dashboard/notifications")}
              className="h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm active:bg-slate-100"
            >
              <Feather name="bell" size={18} color="#1d4ed8" />
              {unreadCount > 0 ? <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger-700" /> : null}
            </Pressable>
          }
        />

        <Animated.View entering={reveal(0)} className="flex-row gap-3">
          <MetricTile
            label="Active courses"
            value={data.activeCourses.length}
            icon="book-open"
            tone="brand"
            onPress={() => router.push("/(student)/courses")}
          />
          <MetricTile label="Upcoming tests" value={data.upcomingTests.length} icon="edit-3" tone={data.upcomingTests.length > 0 ? "warning" : "neutral"} />
          <MetricTile label="Unread updates" value={unreadCount} icon="bell" tone={unreadCount > 0 ? "info" : "neutral"} />
        </Animated.View>

        {data.paymentReviewCount > 0 ? (
          <Animated.View entering={reveal(1)}>
            <Pressable
              onPress={() => router.push("/(student)/payments")}
              className="flex-row items-center gap-3 rounded-2xl bg-warning-100 px-4 py-3 active:opacity-80"
            >
              <Feather name="clock" size={18} color="#a16207" />
              <Text className="flex-1 text-sm font-medium text-warning-700">
                {data.paymentReviewCount} payment{data.paymentReviewCount === 1 ? "" : "s"} under review.
              </Text>
              <Feather name="chevron-right" size={16} color="#a16207" />
            </Pressable>
          </Animated.View>
        ) : null}

        {data.nextClass ? (
          <Animated.View entering={reveal(2)}>
            <NextClassCard session={data.nextClass} />
          </Animated.View>
        ) : null}

        <Animated.View entering={reveal(3)}>
          {data.activeCourses.length > 0 ? (
            <Section title="My courses">
              <View className="gap-3">
                {data.activeCourses.map((enrollment) => (
                  <CourseCard key={enrollment.id} enrollment={enrollment} />
                ))}
              </View>
            </Section>
          ) : (
            <EmptyState icon="book-open" title="No active courses" description="Explore the catalogue and enroll in a course to get started." actionLabel="Explore courses" onAction={() => router.push("/(student)/courses/explore")} />
          )}
        </Animated.View>

        {data.continueRecording ? (
          <Animated.View entering={reveal(4)}>
            <Section title="Continue watching">
              <Pressable
                onPress={() =>
                  data.continueRecording?.enrollmentId
                    ? router.push({ pathname: "/(student)/courses/[enrollmentId]/recordings", params: { enrollmentId: data.continueRecording.enrollmentId } })
                    : undefined
                }
                disabled={!data.continueRecording.enrollmentId}
                className="flex-row items-center gap-3 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 active:bg-slate-50"
              >
                <View className="h-11 w-11 items-center justify-center rounded-full bg-brand-100">
                  <Feather name="play" size={18} color="#1d4ed8" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-slate-900">{data.continueRecording.title}</Text>
                  <Text className="mt-0.5 text-xs text-slate-500">{data.continueRecording.courseTitle}</Text>
                  <ProgressBar percent={data.continueRecording.progressPercent} />
                </View>
                {data.continueRecording.enrollmentId ? <Feather name="chevron-right" size={18} color="#94a3b8" /> : null}
              </Pressable>
            </Section>
          </Animated.View>
        ) : null}

        {data.upcomingTests.length > 0 ? (
          <Animated.View entering={reveal(5)}>
            <Section title="Upcoming tests">
              <View className="gap-2">
                {data.upcomingTests.map((test) => (
                  <Pressable
                    key={test.id}
                    onPress={() =>
                      test.enrollmentId
                        ? router.push({
                            pathname: "/(student)/courses/[enrollmentId]/tests/[testId]",
                            params: { enrollmentId: test.enrollmentId, testId: test.id },
                          })
                        : undefined
                    }
                    disabled={!test.enrollmentId}
                    className="flex-row items-center gap-2 rounded-2xl border border-slate-100 bg-white shadow-sm p-4 active:bg-slate-50"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-slate-900">{test.title}</Text>
                      <Text className="mt-0.5 text-xs text-slate-500">{test.courseTitle}</Text>
                      <Text className="mt-1.5 text-xs font-medium text-brand-700">{test.availability}</Text>
                    </View>
                    {test.enrollmentId ? <Feather name="chevron-right" size={18} color="#94a3b8" /> : null}
                  </Pressable>
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}

        {data.announcements.length > 0 ? (
          <Animated.View entering={reveal(6)}>
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
          </Animated.View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
