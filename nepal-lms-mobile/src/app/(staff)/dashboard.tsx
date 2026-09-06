import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ListSkeleton } from "@/components/skeleton";
import { MetricTile } from "@/components/metric-tile";
import { PaymentQueueCard } from "@/components/payment-queue-card";
import { ScreenHeader } from "@/components/screen-header";
import { Section } from "@/components/section";
import { StaffStudentRow } from "@/components/staff-student-row";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchPaymentQueuePage, fetchStaffStudentsPage } from "@/lib/data/staff";
import { timeOfDayGreeting } from "@/lib/greeting";

function reveal(index: number) {
  return FadeInDown.duration(320).delay(index * 60);
}

export default function StaffDashboard() {
  const user = useSessionStore((state) => state.user);
  const router = useRouter();

  const [studentsQuery, pendingPaymentsQuery] = useQueries({
    queries: [
      { queryKey: ["staff", "dashboard", "students"], queryFn: () => fetchStaffStudentsPage(1) },
      { queryKey: ["staff", "dashboard", "pending-payments"], queryFn: () => fetchPaymentQueuePage(1, "under_review") },
    ],
  });

  const isPending = studentsQuery.isPending || pendingPaymentsQuery.isPending;
  const isError = studentsQuery.isError || pendingPaymentsQuery.isError;

  if (isPending) {
    return (
      <AppScreen edges={["top"]}>
        <ListSkeleton count={3} />
      </AppScreen>
    );
  }

  if (isError) {
    const error = studentsQuery.error ?? pendingPaymentsQuery.error;
    const message = isNormalizedApiError(error) ? error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Button
          label="Try again"
          fullWidth={false}
          onPress={() => {
            studentsQuery.refetch();
            pendingPaymentsQuery.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const recentStudents = studentsQuery.data!.items.slice(0, 4);
  const pendingPayments = pendingPaymentsQuery.data!.items.slice(0, 3);

  return (
    <AppScreen edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-6 gap-6"
        refreshControl={
          <RefreshControl
            refreshing={studentsQuery.isRefetching || pendingPaymentsQuery.isRefetching}
            onRefresh={() => {
              studentsQuery.refetch();
              pendingPaymentsQuery.refetch();
            }}
          />
        }
      >
        <ScreenHeader eyebrow="Staff portal" title={user ? timeOfDayGreeting(user.name.split(" ")[0]) : "Welcome back"} />

        <Animated.View entering={reveal(0)} className="flex-row gap-3">
          <MetricTile
            label="Payments to review"
            value={pendingPaymentsQuery.data!.total}
            icon="credit-card"
            tone={pendingPaymentsQuery.data!.total > 0 ? "warning" : "success"}
            onPress={() => router.push("/(staff)/payments")}
          />
          <MetricTile
            label="Total students"
            value={studentsQuery.data!.total}
            icon="users"
            tone="brand"
            onPress={() => router.push("/(staff)/students")}
          />
        </Animated.View>

        {pendingPayments.length > 0 ? (
          <Animated.View entering={reveal(1)}>
            <Section title="Awaiting review">
              <View className="gap-3">
                {pendingPayments.map((payment) => (
                  <PaymentQueueCard key={payment.id} payment={payment} />
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}

        {recentStudents.length > 0 ? (
          <Animated.View entering={reveal(2)}>
            <Section title="Recent students">
              <View className="gap-3">
                {recentStudents.map((student) => (
                  <StaffStudentRow key={student.id} student={student} />
                ))}
              </View>
            </Section>
          </Animated.View>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}
