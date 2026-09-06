import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { AppScreen } from "@/components/app-screen";
import { EmptyState as SharedEmptyState } from "@/components/empty-state";
import { ScreenHeader } from "@/components/screen-header";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAcademicReport, fetchEnrollmentReport, fetchFinanceReport } from "@/lib/data/admin";

const tabs = [
  { value: "academic", label: "Academic" },
  { value: "enrollments", label: "Enrollments" },
  { value: "finance", label: "Finance" },
] as const;

type Tab = (typeof tabs)[number]["value"];

function npr(value: number): string {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

export default function AdminReportsScreen() {
  const [tab, setTab] = useState<Tab>("academic");

  return (
    <AppScreen edges={["top"]}>
      <View className="gap-3 px-5 pt-6">
        <ScreenHeader title="Reports" />
        <View className="flex-row gap-2">
          {tabs.map((option) => {
            const selected = tab === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setTab(option.value)}
                className={`flex-1 items-center rounded-xl border px-3.5 py-2.5 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-bold ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {tab === "academic" ? <AcademicReport /> : tab === "enrollments" ? <EnrollmentReport /> : <FinanceReport />}
    </AppScreen>
  );
}

function AcademicReport() {
  const report = useQuery({ queryKey: ["admin", "reports", "academic"], queryFn: fetchAcademicReport });

  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState message={isNormalizedApiError(report.error) ? report.error.message : "Something went wrong."} onRetry={() => report.refetch()} />;

  return (
    <ScrollView contentContainerClassName="gap-3 px-5 py-4">
      <Text className="text-xs text-slate-500">Every batch, current standing across attendance, tests, syllabus and recordings.</Text>
      {report.data.length === 0 ? <EmptyState /> : null}
      {report.data.map((row) => (
        <View key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-sm font-semibold text-slate-900">{row.batch}</Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {row.students} student{row.students === 1 ? "" : "s"}
            {row.followUp > 0 ? ` · ${row.followUp} need follow-up` : ""}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Metric label="Attendance" value={row.attendance} />
            <Metric label="Test avg" value={row.testAverage} />
            <Metric label="Syllabus" value={row.syllabus} />
            <Metric label="Recordings" value={row.recordings} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function EnrollmentReport() {
  const report = useQuery({ queryKey: ["admin", "reports", "enrollments"], queryFn: fetchEnrollmentReport });

  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState message={isNormalizedApiError(report.error) ? report.error.message : "Something went wrong."} onRetry={() => report.refetch()} />;

  return (
    <ScrollView contentContainerClassName="gap-3 px-5 py-4">
      <Text className="text-xs text-slate-500">Last six months, newest first.</Text>
      {report.data.length === 0 ? <EmptyState /> : null}
      {[...report.data].reverse().map((row) => (
        <View key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Text className="text-sm font-semibold text-slate-900">{row.period}</Text>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Metric label="New" value={String(row.new)} />
            <Metric label="Approved" value={String(row.approved)} />
            <Metric label="Pending" value={String(row.pending)} />
            <Metric label="Rejected" value={String(row.rejected)} />
            {row.free > 0 ? <Metric label="Free (historical)" value={String(row.free)} /> : null}
            {row.transfers > 0 ? <Metric label="Transfers (historical)" value={String(row.transfers)} /> : null}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function FinanceReport() {
  const report = useQuery({ queryKey: ["admin", "reports", "finance"], queryFn: fetchFinanceReport });

  if (report.isPending) return <Loading />;
  if (report.isError) return <ErrorState message={isNormalizedApiError(report.error) ? report.error.message : "Something went wrong."} onRetry={() => report.refetch()} />;

  return (
    <ScrollView contentContainerClassName="gap-3 px-5 py-4">
      <Text className="text-xs text-slate-500">Last 30 days, newest first.</Text>
      {report.data.length === 0 ? <EmptyState /> : null}
      {report.data.map((row) => (
        <View key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-slate-900">{row.date}</Text>
            <Text className="text-sm font-bold text-slate-950">{npr(row.net)}</Text>
          </View>
          <Text className="mt-0.5 text-xs text-slate-500">
            {row.transactions} transaction{row.transactions === 1 ? "" : "s"}
            {row.pending > 0 ? ` · ${row.pending} pending` : ""}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Metric label="Gross" value={npr(row.gross)} />
            <Metric label="Refunds" value={npr(row.refunds)} />
            <Metric label="Adjustments" value={npr(row.adjustments)} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[70px]">
      <Text className="text-sm font-bold text-slate-900">{value}</Text>
      <Text className="text-xs text-slate-500">{label}</Text>
    </View>
  );
}

function Loading() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator color="#1d4ed8" />
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <Text className="text-center text-sm text-slate-600">{message}</Text>
      <Pressable onPress={onRetry} className="h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
        <Text className="text-sm font-semibold text-white">Try again</Text>
      </Pressable>
    </View>
  );
}

function EmptyState() {
  return <SharedEmptyState icon="bar-chart-2" title="No data for this window" description="Figures for this reporting period aren't available yet." />;
}
