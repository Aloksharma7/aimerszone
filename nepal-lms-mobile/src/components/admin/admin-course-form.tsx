import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { fetchAdminCategories, type AdminCourseInput } from "@/lib/data/admin";
import type { AdminCourseDetail } from "@/types/lms";

const featureOptions = ["Live", "Recordings", "Tests", "Notes"];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

export type CourseFormValues = AdminCourseInput;

function initialValues(course?: AdminCourseDetail | null): CourseFormValues {
  return {
    title: course?.title ?? "",
    slug: course?.slug ?? "",
    code: course?.code ?? "",
    categoryId: course?.categoryId ?? null,
    shortDescription: course?.shortDescription ?? "",
    description: course?.description ?? "",
    accessType: course?.accessType ?? "paid",
    priceNpr: course?.startingPriceNpr ?? 0,
    originalPriceNpr: course?.originalPriceNpr ?? null,
    thumbnailUrl: course?.thumbnailUrl ?? null,
    features: course?.features?.length ? course.features : ["Live", "Recordings", "Tests", "Notes"],
    published: course?.published ?? false,
  };
}

export function useAdminCourseForm(course?: AdminCourseDetail | null) {
  const editing = Boolean(course);
  const [values, setValues] = useState<CourseFormValues>(() => initialValues(course));
  const [slugTouched, setSlugTouched] = useState(editing);

  function update<K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(title: string) {
    setValues((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
  }

  function hydrate(course: AdminCourseDetail) {
    setValues(initialValues(course));
    setSlugTouched(true);
  }

  function validate(): string | null {
    if (values.title.trim().length < 4) return "Enter a clear course title of at least 4 characters.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) return "The slug must use lowercase letters, numbers and hyphens only.";
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(values.code)) return "The course code must be 3–30 letters, numbers, hyphens or underscores.";
    if (!values.categoryId) return "Choose a category.";
    if (values.shortDescription.trim().length < 20) return "Add a short description of at least 20 characters.";
    if (values.description.trim().length < 50) return "Add a full description of at least 50 characters.";
    if (values.accessType === "paid" && values.priceNpr < 1) return "Paid courses require a positive price.";
    if (values.originalPriceNpr != null && values.originalPriceNpr < values.priceNpr) return "Original price cannot be below the current price.";
    if (!values.features.length) return "Select at least one learning feature.";
    return null;
  }

  return { values, update, updateTitle, hydrate, slugTouched, setSlugTouched, validate, editing };
}

export function AdminCourseFormFields({
  values,
  update,
  updateTitle,
  editing,
}: {
  values: CourseFormValues;
  update: <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) => void;
  updateTitle: (title: string) => void;
  editing: boolean;
}) {
  const categories = useQuery({ queryKey: ["admin", "categories"], queryFn: fetchAdminCategories });

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Course title</Text>
        <TextInput
          value={values.title}
          onChangeText={updateTitle}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Course code</Text>
        <TextInput
          value={values.code}
          onChangeText={(value) => update("code", value)}
          placeholder="BBS-MICRO-01"
          autoCapitalize="characters"
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
          placeholderTextColor="#94a3b8"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">URL slug</Text>
        <TextInput
          value={values.slug}
          onChangeText={(value) => update("slug", slugify(value))}
          editable={!editing}
          className={`h-11 rounded-xl border border-slate-300 px-4 text-base text-slate-900 ${editing ? "bg-slate-100" : "bg-white"}`}
        />
        {editing ? <Text className="text-xs text-slate-500">The slug is locked after creation to avoid broken links.</Text> : null}
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Category</Text>
        <View className="flex-row flex-wrap gap-2">
          {(categories.data ?? []).map((category) => {
            const selected = values.categoryId === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => update("categoryId", category.id)}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{category.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Short description</Text>
        <TextInput
          value={values.shortDescription}
          onChangeText={(value) => update("shortDescription", value)}
          multiline
          textAlignVertical="top"
          maxLength={240}
          className="h-20 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Full description</Text>
        <TextInput
          value={values.description}
          onChangeText={(value) => update("description", value)}
          multiline
          textAlignVertical="top"
          maxLength={5000}
          className="h-32 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900"
        />
      </View>

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Access type</Text>
        <View className="flex-row gap-2">
          {(["paid", "free"] as const).map((option) => {
            const selected = values.accessType === option;
            return (
              <Pressable
                key={option}
                onPress={() => update("accessType", option)}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option === "paid" ? "Paid course" : "Free course"}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {values.accessType === "paid" ? (
        <>
          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Current price (NPR)</Text>
            <TextInput
              value={String(values.priceNpr)}
              onChangeText={(value) => update("priceNpr", Number(value) || 0)}
              keyboardType="number-pad"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            />
          </View>
          <View className="gap-2">
            <Text className="text-sm font-semibold text-slate-700">Original price (NPR, optional)</Text>
            <TextInput
              value={values.originalPriceNpr != null ? String(values.originalPriceNpr) : ""}
              onChangeText={(value) => update("originalPriceNpr", value ? Number(value) || 0 : null)}
              keyboardType="number-pad"
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
            />
          </View>
        </>
      ) : null}

      <View className="gap-2">
        <Text className="text-sm font-semibold text-slate-700">Learning features</Text>
        <View className="flex-row flex-wrap gap-2">
          {featureOptions.map((feature) => {
            const selected = values.features.includes(feature);
            return (
              <Pressable
                key={feature}
                onPress={() => update("features", selected ? values.features.filter((item) => item !== feature) : [...values.features, feature])}
                className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{feature}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
