import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { TextInputProps } from "react-native";
import { Pressable, Text, TextInput, View } from "react-native";

type FormFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: Path<T>;
  label: string;
  error?: string;
  leadingIcon?: keyof typeof Feather.glyphMap;
} & Omit<TextInputProps, "value" | "onChangeText" | "onBlur">;

export function FormField<T extends FieldValues>({
  control,
  name,
  label,
  error,
  leadingIcon,
  editable = true,
  secureTextEntry,
  ...inputProps
}: FormFieldProps<T>) {
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-slate-700">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <View
            className={`h-12 flex-row items-center rounded-xl border px-3.5 ${error ? "border-danger-700" : "border-slate-200"} ${editable ? "bg-white" : "bg-slate-100"}`}
          >
            {leadingIcon ? <Feather name={leadingIcon} size={17} color="#94a3b8" style={{ marginRight: 8 }} /> : null}
            <TextInput
              className="flex-1 text-base text-slate-900"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={editable}
              secureTextEntry={secureTextEntry ? hidden : undefined}
              placeholderTextColor="#94a3b8"
              {...inputProps}
            />
            {secureTextEntry ? (
              <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8}>
                <Feather name={hidden ? "eye" : "eye-off"} size={17} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
        )}
      />
      {error ? <Text className="mt-1 text-sm text-danger-700">{error}</Text> : null}
    </View>
  );
}
