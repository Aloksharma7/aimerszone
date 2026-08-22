import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { DateTimeField } from "@/components/date-time-field";
import { fetchAdminCourseOptions, fetchAdminTeacherOptions, type AdminBatchInput } from "@/lib/data/admin";
import type { AdminBatch } from "@/types/lms";

const statusOptions: { value: AdminBatchInput["status"]; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "ongoing", label: "Ongoing" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

function toDateInput(date: string | null): string | null {
  return date ? date.slice(0, 10) : null;
}

function initialValues(batch?: AdminBatch | null): AdminBatchInput {
  return {
    title: batch?.title ?? "",
    courseId: batch?.courseId ?? "",
    teacherIds: batch?.teacherIds ?? [],
    scheduleSummary: batch?.scheduleSummary ?? "",
    startDate: toDateInput(batch?.startDate ?? null),
    endDate: toDateInput(batch?.endDate ?? null),
    accessUntilDate: toDateInput(batch?.accessUntilDate ?? null),
    priceNpr: batch?.priceNpr ?? 0,
    capacity: batch?.capacity || 60,
    status: (batch?.status as AdminBatchInput["status"]) ?? "draft",
  };
}

export function useAdminBatchForm(batch?: AdminBatch | null) {
  const [values, setValues] = useState<AdminBatchInput>(() => initialValues(batch));

  function update<K extends keyof AdminBatchInput>(key: K, value: AdminBatchInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function hydrate(next: AdminBatch) {
    setValues(initialValues(next));
  }

  function validate(): string | null {
    if (values.title.trim().length < 4) return "Enter a clear batch title.";
    if (!values.courseId) return "Choose a course.";
    if (values.teacherIds.length === 0) return "Choose at least one teacher.";
    if (!values.scheduleSummary.trim()) return "Enter the class schedule.";
    if (values.capacity < 1 || values.capacity > 2000) return "Capacity must be between 1 and 2,000.";
    if (values.startDate && values.endDate && values.endDate < values.startDate) return "End date must be after the start date.";
    if (values.accessUntilDate && values.endDate && values.accessUntilDate < values.endDate) return "Access must run to at least the end date.";
    if (values.priceNpr < 0 || values.priceNpr > 10000000) return "Enter a price between 0 and 10,000,000.";
    return null;
  }

  return { values, update, hydrate, validate };
}

function OptionalDateField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-slate-700">{label}</Text>
      {value ? (
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <DateTimeField
              label=""
              mode="date"
              value={new Date(`${value}T00:00:00`)}
              onChange={(date) => onChange(date.toISOString().slice(0, 10))}
            />
          </View>
          <Pressable onPress={() => onChange(null)} className="h-11 items-center justify-center rounded-xl border border-slate-300 px-3 active:bg-slate-100">
            <Text className="text-xs font-semibold text-slate-700">Clear</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => onChange(new Date().toISOString().slice(0, 10))}
          className="h-11 flex-row items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white active:bg-slate-50"
        >
          <Text className="text-sm text-slate-500">Set date</Text>
        </Pressable>
      )}
      {hint ? <Text className="text-xs text-slate-500">{hint}</Text> : null}
    </View>
  );
}

export function AdminBatchFormFields({
  values,
  update,
}: {
  values: AdminBatchInput;
  update: <K extends keyof AdminBatchInput>(key: K, value: AdminBatchInput[K]) => void;
}) {
  const courses = useQuery({ queryKey: ["admin", "course-options"], queryFn: fetchAdminCourseOptions });
  const teachers = useQuery({ queryKey: ["admin", "teacher-options"], queryFn: fetchAdminTeacherOptions });

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Batch title</Text>
        <TextInput
          value={values.title}
          onChangeText={(value) => update("title", value)}
          placeholder="Microeconomics · Evening Batch 2083"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Course</Text>
        <View className="flex-row flex-wrap gap-2">
          {(courses.data ?? []).map((course) => {
            const selected = values.courseId === course.id;
            return (
              <Pressable
                key={course.id}
                onPress={() => update("courseId", course.id)}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{course.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Teachers</Text>
        <Text className="text-xs text-slate-500">Tick everyone who teaches this batch. They each see it in their own portal.</Text>
        <View className="gap-1 rounded-xl border border-slate-300 bg-white p-2">
          {(teachers.data ?? []).length === 0 ? (
            <Text className="px-2 py-3 text-sm text-slate-500">No teacher accounts yet. Create one under Users first.</Text>
          ) : (
            teachers.data!.map((teacher) => {
              const checked = values.teacherIds.includes(teacher.id);
              return (
                <Pressable
                  key={teacher.id}
                  onPress={() => update("teacherIds", checked ? values.teacherIds.filter((item) => item !== teacher.id) : [...values.teacherIds, teacher.id])}
                  className="flex-row items-center gap-3 rounded-lg px-2 py-2.5 active:bg-slate-50"
                >
                  <View className={`h-5 w-5 items-center justify-center rounded border ${checked ? "border-brand-700 bg-brand-700" : "border-slate-300"}`}>
                    {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                  </View>
                  <Text className="flex-1 text-sm text-slate-800">{teacher.name}</Text>
                </Pressable>
              );
            })
          )}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Capacity</Text>
        <TextInput
          value={String(values.capacity)}
          onChangeText={(value) => update("capacity", Number(value) || 0)}
          keyboardType="number-pad"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
        />
      </View>

      <OptionalDateField label="Start date" value={values.startDate} onChange={(value) => update("startDate", value)} />
      <OptionalDateField label="End date" value={values.endDate} onChange={(value) => update("endDate", value)} />
      <OptionalDateField
        label="Access until"
        hint="Content stays available to enrolled students until this date. Leave unset to use the institution default."
        value={values.accessUntilDate}
        onChange={(value) => update("accessUntilDate", value)}
      />

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Price (NPR)</Text>
        <Text className="text-xs text-slate-500">The fee students are asked for. 0 makes the batch free.</Text>
        <TextInput
          value={String(values.priceNpr)}
          onChangeText={(value) => update("priceNpr", Number(value) || 0)}
          keyboardType="number-pad"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Schedule summary</Text>
        <Text className="text-xs text-slate-500">Use Nepal time and keep the public schedule concise.</Text>
        <TextInput
          value={values.scheduleSummary}
          onChangeText={(value) => update("scheduleSummary", value)}
          placeholder="Sun–Fri · 7:00–8:00 PM NPT"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Operational status</Text>
        <View className="flex-row flex-wrap gap-2">
          {statusOptions.map((option) => {
            const selected = values.status === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => update("status", option.value)}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
