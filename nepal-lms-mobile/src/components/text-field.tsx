import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import type { TextInputProps } from "react-native";
import { Text, TextInput, View } from "react-native";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  leadingIcon?: keyof typeof Feather.glyphMap;
} & Omit<TextInputProps, "value" | "onChangeText">;

/**
 * The plain-controlled sibling of FormField — same visual language (focus
 * border, error state), but for the ~65 screens that manage their own
 * useState instead of react-hook-form. One definition of "what a text
 * input looks like" instead of every screen re-bordering a TextInput.
 */
export function TextField({ label, value, onChangeText, error, leadingIcon, editable = true, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const iconColor = error ? "#b91c1c" : focused ? "#1d4ed8" : "#94a3b8";

  return (
    <View className="gap-1.5">
      <Text className={`text-sm font-semibold ${focused ? "text-brand-700" : "text-slate-700"}`}>{label}</Text>
      <View
        className={`h-12 flex-row items-center rounded-xl border-[1.5px] px-3.5 ${
          error ? "border-danger-700 bg-danger-100/30" : focused ? "border-brand-600 bg-white" : "border-slate-200 bg-white"
        } ${editable ? "" : "bg-slate-100"}`}
      >
        {leadingIcon ? <Feather name={leadingIcon} size={16} color={iconColor} style={{ marginRight: 8 }} /> : null}
        <TextInput
          className="h-full flex-1 text-base text-slate-900"
          value={value}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          editable={editable}
          placeholderTextColor="#94a3b8"
          {...inputProps}
        />
      </View>
      {error ? <Text className="text-sm text-danger-700">{error}</Text> : null}
    </View>
  );
}
