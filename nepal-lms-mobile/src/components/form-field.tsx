import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller } from "react-hook-form";
import type { TextInputProps } from "react-native";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";

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
  onFocus,
  ...inputProps
}: FormFieldProps<T>) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const [focused, setFocused] = useState(false);
  const shakeX = useSharedValue(0);

  // A quick horizontal shake draws the eye to a field the moment its
  // validation fails, instead of relying on the student to spot a small red
  // line of text below it.
  useEffect(() => {
    if (!error) return;
    shakeX.value = withSequence(
      withTiming(-6, { duration: 45 }),
      withTiming(6, { duration: 90 }),
      withTiming(-4, { duration: 90 }),
      withTiming(0, { duration: 60 }),
    );
  }, [error, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
  const iconColor = error ? "#b91c1c" : focused ? "#1d4ed8" : "#94a3b8";

  return (
    <View>
      <Text className={`mb-1.5 text-sm font-semibold ${focused ? "text-brand-700" : "text-slate-700"}`}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <Animated.View
            style={shakeStyle}
            className={`h-14 flex-row items-center rounded-2xl border-[1.5px] px-3.5 ${
              error ? "border-danger-700 bg-danger-100/30" : focused ? "border-brand-600 bg-white" : "border-slate-200 bg-white"
            } ${editable ? "" : "bg-slate-100"}`}
          >
            {leadingIcon ? <Feather name={leadingIcon} size={17} color={iconColor} style={{ marginRight: 8 }} /> : null}
            <TextInput
              className="h-full flex-1 text-base text-slate-900"
              value={value}
              onChangeText={onChange}
              onFocus={(event) => {
                setFocused(true);
                onFocus?.(event);
              }}
              onBlur={() => {
                setFocused(false);
                onBlur();
              }}
              editable={editable}
              secureTextEntry={secureTextEntry ? hidden : undefined}
              placeholderTextColor="#94a3b8"
              {...inputProps}
            />
            {secureTextEntry ? (
              <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8} accessibilityLabel={hidden ? "Show password" : "Hide password"}>
                <Feather name={hidden ? "eye" : "eye-off"} size={17} color="#94a3b8" />
              </Pressable>
            ) : null}
          </Animated.View>
        )}
      />
      {error ? <Text className="mt-1.5 text-sm text-danger-700">{error}</Text> : null}
    </View>
  );
}
