import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

/** A single yes/no acknowledgment (e.g. "I have read X") reads as a checkbox everywhere else in the product — a Switch is for a setting you can flip back and forth, not an agreement you tick once. */
export function Checkbox({
  checked,
  onToggle,
  label,
  description,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-200 p-3.5 active:bg-slate-50"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-md border-[1.5px] ${
          checked ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"
        }`}
      >
        {checked ? <Feather name="check" size={13} color="#ffffff" /> : null}
      </View>
      <View className="flex-1">
        <Text className="text-sm text-slate-700">{label}</Text>
        {description ? <Text className="text-xs text-slate-500">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
