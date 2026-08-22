import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { DateTimeField } from "@/components/date-time-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { createTeacherClass, fetchTeacherBatches } from "@/lib/data/teacher";

function combine(date: Date, time: Date): Date {
  const result = new Date(date);
  result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}

export default function NewClassScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const batches = useQuery({ queryKey: ["teacher", "batches"], queryFn: fetchTeacherBatches });

  const [batchId, setBatchId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [duration, setDuration] = useState("60");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const startsAt = combine(date, startTime);
      const endsAt = new Date(startsAt.getTime() + Number(duration) * 60_000);
      return createTeacherClass({
        batchId: batchId!,
        title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        instructions: instructions || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "classes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "dashboard"] });
      router.back();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not schedule this class."),
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

  const canSubmit = Boolean(batchId && title.trim().length >= 3 && Number(duration) >= 10 && !create.isPending);

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
        </View>

        <DateTimeField label="Date" mode="date" value={date} onChange={setDate} minimumDate={new Date()} />
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
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Schedule class</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
