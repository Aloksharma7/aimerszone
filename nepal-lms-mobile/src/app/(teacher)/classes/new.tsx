import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { DateTimeField } from "@/components/date-time-field";
import { TextField } from "@/components/text-field";
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
        <Button label="Try again" onPress={() => batches.refetch()} fullWidth={false} />
      </SafeAreaView>
    );
  }

  const canSubmit = Boolean(batchId && title.trim().length >= 3 && Number(duration) >= 10 && !create.isPending);

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Batch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipGroup options={batches.data.map((b) => ({ value: b.id, label: `${b.courseTitle} · ${b.batchTitle}` }))} value={batchId} onChange={setBatchId} />
          </ScrollView>
        </View>

        <TextField label="Topic" value={title} onChangeText={setTitle} editable={!create.isPending} />

        <DateTimeField label="Date" mode="date" value={date} onChange={setDate} minimumDate={new Date()} />
        <DateTimeField label="Start time" mode="time" value={startTime} onChange={setStartTime} />

        <TextField label="Duration (minutes)" value={duration} onChangeText={setDuration} keyboardType="number-pad" editable={!create.isPending} />

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

        <Button
          label="Schedule class"
          loading={create.isPending}
          disabled={!canSubmit}
          size="lg"
          onPress={() => {
            setError(null);
            create.mutate();
          }}
        />
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
