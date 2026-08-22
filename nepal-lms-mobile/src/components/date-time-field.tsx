import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

/**
 * Android shows its picker as a modal dialog via the imperative API;
 * mounting the declarative <DateTimePicker> there instead renders it inline
 * on the page, which is not how Android pickers are meant to look. iOS has
 * no imperative API, so it gets the declarative spinner instead.
 */
export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  label: string;
  mode: "date" | "time";
  value: Date;
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const [showIosPicker, setShowIosPicker] = useState(false);

  function open() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode,
        minimumDate,
        maximumDate,
        onChange: (event, selected) => {
          if (event.type === "set" && selected) onChange(selected);
        },
      });
    } else {
      setShowIosPicker(true);
    }
  }

  const display = mode === "date" ? value.toLocaleDateString() : value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <View>
      <Text className="mb-1.5 text-sm font-semibold text-slate-700">{label}</Text>
      <Pressable onPress={open} className="h-12 justify-center rounded-xl border border-slate-300 bg-white px-4">
        <Text className="text-base text-slate-900">{display}</Text>
      </Pressable>
      {Platform.OS === "ios" && showIosPicker ? (
        <DateTimePicker
          value={value}
          mode={mode}
          display="spinner"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, selected) => {
            setShowIosPicker(false);
            if (event.type === "set" && selected) onChange(selected);
          }}
        />
      ) : null}
    </View>
  );
}
