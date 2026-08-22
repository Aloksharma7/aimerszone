import { useQueries } from "@tanstack/react-query";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ListSkeleton } from "@/components/skeleton";
import { MetricTile } from "@/components/metric-tile";
import { PaymentQueueCard } from "@/components/payment-queue-card";
import { Section } from "@/components/section";
import { DrawerMenuButton } from "@/components/side-drawer";
import { StaffStudentRow } from "@/components/staff-student-row";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { fetchPaymentQueuePage, fetchStaffStudentsPage } from "@/lib/data/staff";

export default function StaffDashboard() {
  const user = useSessionStore((state) => state.user);

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
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton count={3} />
      </SafeAreaView>
    );
  }

  if (isError) {
    const error = studentsQuery.error ?? pendingPaymentsQuery.error;
    const message = isNormalizedApiError(error) ? error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable
          onPress={() => {
            studentsQuery.refetch();
            pendingPaymentsQuery.refetch();
          }}
          className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800"
        >
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const recentStudents = studentsQuery.data!.items.slice(0, 4);
  const pendingPayments = pendingPaymentsQuery.data!.items.slice(0, 3);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
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
        <View className="flex-row items-start gap-2">
          <DrawerMenuButton />
          <View>
            <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">Staff portal</Text>
            <Text className="mt-1 text-2xl font-bold text-slate-950">{user ? `Hi, ${user.name.split(" ")[0]}` : "Welcome back"}</Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          <MetricTile label="Payments to review" value={pendingPaymentsQuery.data!.total} />
        </View>

        {pendingPayments.length > 0 ? (
          <Section title="Awaiting review">
            <View className="gap-3">
              {pendingPayments.map((payment) => (
                <PaymentQueueCard key={payment.id} payment={payment} />
              ))}
            </View>
          </Section>
        ) : null}

        {recentStudents.length > 0 ? (
          <Section title="Recent students">
            <View className="gap-3">
              {recentStudents.map((student) => (
                <StaffStudentRow key={student.id} student={student} />
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
