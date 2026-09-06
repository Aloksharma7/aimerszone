import { Feather } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { z } from "zod";

import { AppScreen } from "@/components/app-screen";
import { type CapturedProof, ProofCapture } from "@/components/proof-capture";
import { FormField } from "@/components/form-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { useSessionStore } from "@/lib/auth/session-store";
import { createStaffCourse, fetchCategoryOptions, uploadCourseThumbnail } from "@/lib/data/staff";

const schema = z.object({
  title: z.string().min(2, "Enter a course title."),
  categoryId: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  accessType: z.enum(["free", "paid"]),
  price: z.string(),
  publish: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function NewCourseScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useSessionStore((state) => state.user);
  const canPublish = user?.permissions.includes("courses.publish") ?? false;

  const categories = useQuery({ queryKey: ["staff", "categories"], queryFn: fetchCategoryOptions });
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; slug: string } | null>(null);
  const [thumbnail, setThumbnail] = useState<CapturedProof | null>(null);
  const [thumbnailDone, setThumbnailDone] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", categoryId: "", shortDescription: "", description: "", accessType: "paid", price: "", publish: false },
  });

  const create = useMutation({
    mutationFn: (values: FormValues) =>
      createStaffCourse({
        title: values.title,
        categoryId: values.categoryId || undefined,
        shortDescription: values.shortDescription || undefined,
        description: values.description || undefined,
        accessType: values.accessType,
        priceNpr: values.price ? Number(values.price) : undefined,
        publish: canPublish && values.publish,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["staff", "courses"] });
      setCreated(result);
    },
    onError: (error) => setServerError(isNormalizedApiError(error) ? error.message : "Could not create this course."),
  });

  const uploadThumbnail = useMutation({
    mutationFn: () => uploadCourseThumbnail(created!.id, thumbnail!),
    onSuccess: () => setThumbnailDone(true),
  });

  if (created) {
    return (
      <AppScreen edges={["bottom"]}>
        <View className="flex-1 gap-4 px-6 py-6">
          <View className="items-center rounded-2xl bg-brand-900 p-6">
            <Feather name="check-circle" size={32} color="#fff" />
            <Text className="mt-2 text-lg font-bold text-white">Course created</Text>
            <Text className="mt-1 text-sm text-brand-100">
              {canPublish ? "You can add batches and a thumbnail next." : "An administrator can publish it once it's ready."}
            </Text>
          </View>

          {thumbnailDone ? (
            <View className="rounded-xl bg-success-100 p-3">
              <Text className="text-sm text-success-700">Thumbnail uploaded.</Text>
            </View>
          ) : (
            <>
              <ProofCapture value={thumbnail} onChange={setThumbnail} />
              {thumbnail ? (
                <Pressable
                  onPress={() => uploadThumbnail.mutate()}
                  disabled={uploadThumbnail.isPending}
                  className="h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
                >
                  {uploadThumbnail.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Upload thumbnail</Text>}
                </Pressable>
              ) : null}
            </>
          )}

          <Pressable onPress={() => router.back()} className="h-12 flex-row items-center justify-center rounded-xl border border-slate-300 active:bg-slate-100">
            <Text className="text-base font-bold text-slate-700">Done</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAwareScrollView className="flex-1" contentContainerClassName="flex-grow gap-4 px-6 py-6" bottomOffset={24} keyboardShouldPersistTaps="handled">
        <FormField control={control} name="title" label="Course title" error={errors.title?.message} editable={!create.isPending} />

        {categories.data && categories.data.length > 0 ? (
          <View>
            <Text className="mb-1.5 text-sm font-semibold text-slate-700">Category (optional)</Text>
            <Controller
              control={control}
              name="categoryId"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap gap-2">
                  {categories.data.map((category) => {
                    const selected = value === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => onChange(selected ? "" : category.id)}
                        className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                      >
                        <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{category.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            />
          </View>
        ) : null}

        <FormField control={control} name="shortDescription" label="Short description (optional)" error={errors.shortDescription?.message} editable={!create.isPending} />

        <FormField
          control={control}
          name="description"
          label="Full description (optional)"
          error={errors.description?.message}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          style={{ height: 120, paddingTop: 12 }}
          editable={!create.isPending}
        />

        <View>
          <Text className="mb-1.5 text-sm font-semibold text-slate-700">Access</Text>
          <Controller
            control={control}
            name="accessType"
            render={({ field: { onChange, value } }) => (
              <View className="flex-row gap-2">
                {(
                  [
                    { value: "paid" as const, label: "Paid" },
                    { value: "free" as const, label: "Free" },
                  ]
                ).map((option) => {
                  const selected = value === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => onChange(option.value)}
                      className={`flex-1 rounded-xl border px-3 py-3 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                    >
                      <Text className={`text-center text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="accessType"
          render={({ field: { value: accessType } }) =>
            accessType === "paid" ? (
              <FormField
                control={control}
                name="price"
                label="Price (Rs.)"
                error={errors.price?.message}
                keyboardType="number-pad"
                editable={!create.isPending}
              />
            ) : (
              <></>
            )
          }
        />

        {canPublish ? (
          <Controller
            control={control}
            name="publish"
            render={({ field: { onChange, value } }) => (
              <Pressable onPress={() => onChange(!value)} className="flex-row items-center gap-3">
                <Feather name={value ? "check-square" : "square"} size={20} color={value ? "#1d4ed8" : "#94a3b8"} />
                <Text className="text-sm text-slate-700">Publish immediately</Text>
              </Pressable>
            )}
          />
        ) : (
          <Text className="text-xs text-slate-400">This will be saved as a draft — you don&apos;t have permission to publish courses.</Text>
        )}

        {serverError ? (
          <View className="rounded-xl bg-danger-100 p-3">
            <Text className="text-sm text-danger-700">{serverError}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSubmit((values) => {
            setServerError(null);
            create.mutate(values);
          })}
          disabled={isSubmitting || create.isPending}
          className="mt-2 h-12 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Create course</Text>}
        </Pressable>
      </KeyboardAwareScrollView>
    </AppScreen>
  );
}
