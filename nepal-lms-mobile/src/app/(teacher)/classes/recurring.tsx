import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateTimeField } from "@/components/date-time-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createRecurringTeacherClasses, fetchTeacherBatches, type RecurringClassResult } from "@/lib/data/teacher";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

export default function RecurringClassScreen() {
  const router = useRouter();
  const batches = useQuery({ queryKey: ["teacher", "batches"], queryFn: fetchTeacherBatches });

  const [batchId, setBatchId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [startTime, setStartTime] = useState(new Date());
  const [duration, setDuration] = useState("60");
  const [frequency, setFrequency] = useState<"daily" | "weekly">("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecurringClassResult | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createRecurringTeacherClasses({
        batchId: batchId!,
        title,
        instructions: instructions || undefined,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        startTime: `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`,
        durationMinutes: Number(duration),
        frequency,
        days: frequency === "weekly" ? days : undefined,
      }),
    onSuccess: setResult,
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not create this schedule."),
  });

  if (batches.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["bottom"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (batches.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(batches.error) ? batches.error.message : "Something went wrong."}</Text>
        <Pressable onPress={() => batches.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (result) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
        <View className="flex-1 gap-4 px-6 py-6">
          <View className="items-center rounded-2xl bg-brand-900 p-6">
            <Text className="text-lg font-bold text-white">
              {result.created} class{result.created === 1 ? "" : "es"} scheduled
            </Text>
            {result.skippedPast > 0 ? (
              <Text className="mt-1 text-sm text-brand-100">
                {result.skippedPast} occurrence{result.skippedPast === 1 ? "" : "s"} in the past were skipped.
              </Text>
            ) : null}
          </View>
          <Pressable onPress={() => router.back()} className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800">
            <Text className="text-base font-bold text-white">Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canSubmit = Boolean(
    batchId && title.trim().length >= 3 && Number(duration) >= 10 && (frequency === "daily" || days.length > 0) && !create.isPending,
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Batch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {batches.data.map((batch) => {
                const selected = batchId === batch.id;
                return (
                  <Pressable
                    key={batch.id}
                    onPress={() => setBatchId(batch.id)}
                    className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>
                      {batch.courseTitle} · {batch.batchTitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Topic</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={title}
            onChangeText={setTitle}
            editable={!create.isPending}
          />
          <Text className="mt-1 text-xs text-slate-400">Each class is numbered automatically, e.g. &quot;{title || "Topic"} — 1&quot;.</Text>
        </View>

        <DateTimeField label="Starting" mode="date" value={startDate} onChange={setStartDate} minimumDate={new Date()} />
        <DateTimeField label="Until" mode="date" value={endDate} onChange={setEndDate} minimumDate={startDate} />
        <DateTimeField label="Start time" mode="time" value={startTime} onChange={setStartTime} />

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Duration (minutes)</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            editable={!create.isPending}
          />
        </View>

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Frequency</Text>
          <View className="flex-row gap-2">
            {(
              [
                { value: "weekly" as const, label: "Weekly" },
                { value: "daily" as const, label: "Daily" },
              ]
            ).map((option) => {
              const selected = frequency === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFrequency(option.value)}
                  className={`flex-1 rounded-xl border px-3 py-3 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                >
                  <Text className={`text-center text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {frequency === "weekly" ? (
          <View>
            <Text className="mb-1.5 text-sm font-semibold text-slate-700">Days of the week</Text>
            <View className="flex-row flex-wrap gap-2">
              {dayLabels.map((label, index) => {
                const selected = days.includes(index);
                return (
                  <Pressable
                    key={label}
                    onPress={() => setDays((current) => (selected ? current.filter((d) => d !== index) : [...current, index]))}
                    className={`h-11 w-11 items-center justify-center rounded-full border ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                  >
                    <Text className={`text-xs font-semibold ${selected ? "text-white" : "text-slate-700"}`}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Instructions (optional)</Text>
          <TextInput
            className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            textAlignVertical="top"
            editable={!create.isPending}
          />
        </View>

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            setError(null);
            create.mutate();
          }}
          disabled={!canSubmit}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create schedule</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
