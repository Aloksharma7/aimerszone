import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { saveAttemptResponses, startAttempt, submitAttempt } from "@/lib/data/attempts";
import type { Attempt, AttemptQuestion } from "@/types/lms";

type AnswerMap = Record<string, string[]>;

function initialAnswers(attempt: Attempt): AnswerMap {
  const map: AnswerMap = {};
  for (const question of attempt.questions) {
    map[question.id] = question.type === "short_text" ? (question.response ? [question.response] : []) : question.responses;
  }
  return map;
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function TestAttemptScreen() {
  const { enrollmentId, testId, attemptId } = useLocalSearchParams<{ enrollmentId: string; testId: string; attemptId: string }>();
  const router = useRouter();

  const session = useQuery({ queryKey: ["student", "attempt", testId], queryFn: () => startAttempt(testId) });

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const submittedRef = useRef(false);

  if (session.data && initializedFor !== session.data.id) {
    setAnswers(initialAnswers(session.data));
    setFlagged(new Set(session.data.questions.filter((q) => q.flagged).map((q) => q.id)));
    setSecondsRemaining(Math.max(0, Math.round((new Date(session.data.expiresAt).getTime() - new Date(session.data.serverNow).getTime()) / 1000)));
    setInitializedFor(session.data.id);
  }

  const submit = useMutation({
    mutationFn: (automatic: boolean) => submitAttempt(attemptId, automatic),
    onSuccess: () => {
      router.replace({
        pathname: "/(student)/courses/[enrollmentId]/tests/[testId]/result",
        params: { enrollmentId, testId, attemptId },
      });
    },
  });

  function buildAnswerList() {
    return Object.entries(answers).map(([questionId, response]) => ({ questionId, response: response.length ? response : null }));
  }

  const save = useMutation({
    mutationFn: () => saveAttemptResponses(attemptId, buildAnswerList(), Array.from(flagged)),
  });

  // Countdown, ticking every second once the attempt has loaded.
  useEffect(() => {
    if (secondsRemaining === null) return;
    if (secondsRemaining <= 0) {
      if (!submittedRef.current) {
        submittedRef.current = true;
        submit.mutate(true);
      }
      return;
    }
    const timer = setTimeout(() => setSecondsRemaining((value) => (value !== null ? value - 1 : value)), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: this effect should only re-run when the number itself changes, not when `submit` is recreated
  }, [secondsRemaining]);

  // Periodic autosave, independent of the countdown re-render cadence.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!submittedRef.current) save.mutate();
    }, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires on a fixed interval regardless of answer/flag changes, which read from state via closures refreshed each render
  }, []);

  if (session.isPending || secondsRemaining === null) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (session.isError) {
    const message = isNormalizedApiError(session.error) ? session.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6">
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => router.back()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const questions = session.data.questions;
  const question = questions[currentIndex];
  const answered = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  function setAnswer(questionId: string, response: string[]) {
    setAnswers((current) => ({ ...current, [questionId]: response }));
  }

  function toggleFlag(questionId: string) {
    setFlagged((current) => {
      const next = new Set(current);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function confirmSubmit() {
    Alert.alert(
      "Submit test?",
      `You've answered ${answered} of ${questions.length} questions. This cannot be undone.`,
      [
        { text: "Keep working", style: "cancel" },
        {
          text: "Submit",
          onPress: () => {
            submittedRef.current = true;
            save.mutate(undefined, { onSettled: () => submit.mutate(false) });
          },
        },
      ],
    );
  }

  const timeCritical = secondsRemaining <= 60;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
        <Text className="text-sm font-semibold text-slate-900">
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <View className={`rounded-full px-3 py-1 ${timeCritical ? "bg-danger-100" : "bg-brand-100"}`}>
          <Text className={`text-sm font-bold ${timeCritical ? "text-danger-700" : "text-brand-700"}`}>{formatClock(secondsRemaining)}</Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-base font-semibold text-slate-900">{question.prompt}</Text>
          <Pressable onPress={() => toggleFlag(question.id)} hitSlop={8}>
            <Feather name="flag" size={20} color={flagged.has(question.id) ? "#a16207" : "#cbd5e1"} />
          </Pressable>
        </View>
        <Text className="text-xs text-slate-400">{question.marks} mark{question.marks === 1 ? "" : "s"}</Text>

        <QuestionInput question={question} value={answers[question.id] ?? []} onChange={(value) => setAnswer(question.id, value)} />
      </ScrollView>

      <View className="flex-row items-center gap-3 border-t border-slate-100 bg-white px-5 py-3">
        <Pressable
          onPress={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
          className="h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100 disabled:opacity-40"
        >
          <Text className="text-sm font-bold text-slate-700">Previous</Text>
        </Pressable>
        {currentIndex === questions.length - 1 ? (
          <Pressable onPress={confirmSubmit} className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800">
            <Text className="text-sm font-bold text-white">Submit</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
            className="h-11 flex-1 items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800"
          >
            <Text className="text-sm font-bold text-white">Next</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function QuestionInput({ question, value, onChange }: { question: AttemptQuestion; value: string[]; onChange: (value: string[]) => void }) {
  if (question.type === "short_text") {
    return (
      <TextInput
        className="min-h-24 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        value={value[0] ?? ""}
        onChangeText={(text) => onChange(text ? [text] : [])}
        multiline
        textAlignVertical="top"
      />
    );
  }

  const isMultiple = question.type === "multiple";

  return (
    <View className="gap-2">
      {question.options.map((option) => {
        const selected = value.includes(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => {
              if (isMultiple) {
                onChange(selected ? value.filter((id) => id !== option.id) : [...value, option.id]);
              } else {
                onChange([option.id]);
              }
            }}
            className={`flex-row items-center gap-3 rounded-xl border p-3 ${selected ? "border-brand-700 bg-brand-50" : "border-slate-200 bg-white"}`}
          >
            <Feather
              name={isMultiple ? (selected ? "check-square" : "square") : selected ? "check-circle" : "circle"}
              size={18}
              color={selected ? "#1d4ed8" : "#94a3b8"}
            />
            <Text className="flex-1 text-sm text-slate-900">
              {option.label}. {option.text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
