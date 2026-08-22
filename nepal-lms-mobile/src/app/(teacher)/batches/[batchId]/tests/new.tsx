import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { isNormalizedApiError } from "@/lib/api/contracts";
import { createTeacherTest } from "@/lib/data/teacher";

type QuestionType = "single" | "multiple" | "true_false" | "short_text";
type DraftOption = { key: string; label: string; isCorrect: boolean };
type DraftQuestion = { key: string; type: QuestionType; prompt: string; marks: string; options: DraftOption[]; acceptedAnswers: string[] };

let keySeed = 0;
function nextKey(): string {
  keySeed += 1;
  return `k${keySeed}`;
}

function blankQuestion(): DraftQuestion {
  return {
    key: nextKey(),
    type: "single",
    prompt: "",
    marks: "1",
    options: [
      { key: nextKey(), label: "", isCorrect: false },
      { key: nextKey(), label: "", isCorrect: false },
    ],
    acceptedAnswers: [""],
  };
}

const questionTypes: { value: QuestionType; label: string }[] = [
  { value: "single", label: "Single choice" },
  { value: "multiple", label: "Multiple choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_text", label: "Short text" },
];

export default function NewTestScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("30");
  const [attempts, setAttempts] = useState("1");
  const [passMark, setPassMark] = useState("40");
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion()]);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) => current.map((question) => (question.key === key ? { ...question, ...patch } : question)));
  }

  function changeQuestionType(key: string, type: QuestionType) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.key !== key) return question;
        if (type === "true_false") {
          return {
            ...question,
            type,
            options: [
              { key: nextKey(), label: "True", isCorrect: true },
              { key: nextKey(), label: "False", isCorrect: false },
            ],
          };
        }
        if (type === "short_text") return { ...question, type };
        if (question.type === "true_false" || question.options.length < 2) {
          return { ...question, type, options: [{ key: nextKey(), label: "", isCorrect: false }, { key: nextKey(), label: "", isCorrect: false }] };
        }
        return { ...question, type };
      }),
    );
  }

  function addOption(questionKey: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === questionKey ? { ...question, options: [...question.options, { key: nextKey(), label: "", isCorrect: false }] } : question,
      ),
    );
  }

  function removeOption(questionKey: string, optionKey: string) {
    setQuestions((current) =>
      current.map((question) => (question.key === questionKey ? { ...question, options: question.options.filter((o) => o.key !== optionKey) } : question)),
    );
  }

  function updateOption(questionKey: string, optionKey: string, patch: Partial<DraftOption>) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              options: question.options.map((option) =>
                option.key === optionKey
                  ? { ...option, ...patch, isCorrect: patch.isCorrect !== undefined && question.type !== "multiple" ? true : (patch.isCorrect ?? option.isCorrect) }
                  : patch.isCorrect && question.type !== "multiple"
                    ? { ...option, isCorrect: false }
                    : option,
              ),
            }
          : question,
      ),
    );
  }

  function create(publish: boolean) {
    setError(null);

    for (const [index, question] of questions.entries()) {
      if (!question.prompt.trim()) {
        setError(`Question ${index + 1} needs a prompt.`);
        return;
      }
      if (question.type === "short_text") {
        if (!question.acceptedAnswers.some((answer) => answer.trim())) {
          setError(`Question ${index + 1} needs at least one accepted answer.`);
          return;
        }
      } else if (!question.options.some((option) => option.isCorrect)) {
        setError(`Question ${index + 1} needs a correct answer marked.`);
        return;
      }
    }

    submit.mutate(publish);
  }

  const submit = useMutation({
    mutationFn: (publish: boolean) =>
      createTeacherTest({
        batchId,
        title,
        durationMinutes: Number(duration),
        attemptsAllowed: Number(attempts),
        passMark: Number(passMark),
        publish,
        questions: questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          marks: Number(question.marks) || 1,
          options:
            question.type === "short_text"
              ? undefined
              : question.options.filter((o) => o.label.trim()).map((option) => ({ label: option.label, isCorrect: option.isCorrect })),
          acceptedAnswers: question.type === "short_text" ? question.acceptedAnswers.filter((a) => a.trim()) : undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId, "tests"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "batch", batchId] });
      router.back();
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "Could not create this test."),
  });

  const canSubmit = Boolean(title.trim().length >= 3 && questions.length > 0 && !submit.isPending);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Title</Text>
          <TextInput
            className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            value={title}
            onChangeText={setTitle}
            editable={!submit.isPending}
          />
        </View>

        <View className="flex-row gap-3">
          <NumberField label="Duration (min)" value={duration} onChange={setDuration} />
          <NumberField label="Attempts" value={attempts} onChange={setAttempts} />
          <NumberField label="Pass mark" value={passMark} onChange={setPassMark} />
        </View>

        <Text className="text-sm font-bold text-slate-900">Questions</Text>

        {questions.map((question, index) => (
          <QuestionCard
            key={question.key}
            index={index}
            question={question}
            onChangeType={(type) => changeQuestionType(question.key, type)}
            onChangePrompt={(prompt) => updateQuestion(question.key, { prompt })}
            onChangeMarks={(marks) => updateQuestion(question.key, { marks })}
            onAddOption={() => addOption(question.key)}
            onRemoveOption={(optionKey) => removeOption(question.key, optionKey)}
            onChangeOptionLabel={(optionKey, label) => updateOption(question.key, optionKey, { label })}
            onSelectCorrect={(optionKey) => updateOption(question.key, optionKey, { isCorrect: true })}
            onToggleMultipleCorrect={(optionKey, value) => updateOption(question.key, optionKey, { isCorrect: value })}
            onChangeAcceptedAnswers={(acceptedAnswers) => updateQuestion(question.key, { acceptedAnswers })}
            onRemove={questions.length > 1 ? () => setQuestions((current) => current.filter((q) => q.key !== question.key)) : undefined}
          />
        ))}

        <Pressable
          onPress={() => setQuestions((current) => [...current, blankQuestion()])}
          className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-brand-700 active:bg-brand-50"
        >
          <Feather name="plus" size={16} color="#1d4ed8" />
          <Text className="text-sm font-bold text-brand-700">Add question</Text>
        </Pressable>

        {error ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => create(true)}
          disabled={!canSubmit}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create and publish</Text>}
        </Pressable>
        <Pressable
          onPress={() => create(false)}
          disabled={!canSubmit}
          className="h-12 flex-row items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100 disabled:opacity-60"
        >
          <Text className="text-base font-bold text-slate-700">Save as draft</Text>
        </Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View className="flex-1">
      <Text className="mb-1.5 text-sm font-semibold text-slate-700">{label}</Text>
      <TextInput
        className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-center text-base text-slate-900"
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
      />
    </View>
  );
}

function QuestionCard({
  index,
  question,
  onChangeType,
  onChangePrompt,
  onChangeMarks,
  onAddOption,
  onRemoveOption,
  onChangeOptionLabel,
  onSelectCorrect,
  onToggleMultipleCorrect,
  onChangeAcceptedAnswers,
  onRemove,
}: {
  index: number;
  question: DraftQuestion;
  onChangeType: (type: QuestionType) => void;
  onChangePrompt: (value: string) => void;
  onChangeMarks: (value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionKey: string) => void;
  onChangeOptionLabel: (optionKey: string, label: string) => void;
  onSelectCorrect: (optionKey: string) => void;
  onToggleMultipleCorrect: (optionKey: string, value: boolean) => void;
  onChangeAcceptedAnswers: (answers: string[]) => void;
  onRemove?: () => void;
}) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-slate-900">Question {index + 1}</Text>
        {onRemove ? (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Feather name="trash-2" size={16} color="#b91c1c" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {questionTypes.map((option) => {
            const selected = question.type === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onChangeType(option.value)}
                className={`rounded-full border px-3 py-1.5 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-xs font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <TextInput
        className="min-h-16 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        placeholder="Question prompt"
        value={question.prompt}
        onChangeText={onChangePrompt}
        multiline
        textAlignVertical="top"
      />

      <View className="w-24">
        <Text className="mb-1 text-xs font-semibold text-slate-700">Marks</Text>
        <TextInput
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-center text-sm text-slate-900"
          value={question.marks}
          onChangeText={onChangeMarks}
          keyboardType="number-pad"
        />
      </View>

      {question.type === "short_text" ? (
        <View className="gap-2">
          <Text className="text-xs font-semibold text-slate-700">Accepted answers</Text>
          {question.acceptedAnswers.map((answer, answerIndex) => (
            <View key={answerIndex} className="flex-row items-center gap-2">
              <TextInput
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={answer}
                onChangeText={(text) => {
                  const next = [...question.acceptedAnswers];
                  next[answerIndex] = text;
                  onChangeAcceptedAnswers(next);
                }}
              />
              {question.acceptedAnswers.length > 1 ? (
                <Pressable onPress={() => onChangeAcceptedAnswers(question.acceptedAnswers.filter((_, i) => i !== answerIndex))} hitSlop={8}>
                  <Feather name="x" size={16} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={() => onChangeAcceptedAnswers([...question.acceptedAnswers, ""])} className="self-start">
            <Text className="text-xs font-semibold text-brand-700">+ Add accepted answer</Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-2">
          <Text className="text-xs font-semibold text-slate-700">Options — tap to mark correct</Text>
          {question.options.map((option) => (
            <View key={option.key} className="flex-row items-center gap-2">
              <Pressable
                onPress={() =>
                  question.type === "multiple" ? onToggleMultipleCorrect(option.key, !option.isCorrect) : onSelectCorrect(option.key)
                }
              >
                <Feather
                  name={question.type === "multiple" ? (option.isCorrect ? "check-square" : "square") : option.isCorrect ? "check-circle" : "circle"}
                  size={20}
                  color={option.isCorrect ? "#15803d" : "#94a3b8"}
                />
              </Pressable>
              <TextInput
                className="h-10 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={option.label}
                onChangeText={(text) => onChangeOptionLabel(option.key, text)}
                editable={question.type !== "true_false"}
              />
              {question.type !== "true_false" && question.options.length > 2 ? (
                <Pressable onPress={() => onRemoveOption(option.key)} hitSlop={8}>
                  <Feather name="x" size={16} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>
          ))}
          {question.type !== "true_false" ? (
            <Pressable onPress={onAddOption} className="self-start">
              <Text className="text-xs font-semibold text-brand-700">+ Add option</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
