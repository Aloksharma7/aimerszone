import { Pressable, ScrollView, Text, View } from "react-native";

export type ChipOption<T> = { value: T; label: string };

/**
 * The "row of pills, selected = filled brand" pattern was hand-built four
 * separate times (role picker, status filters, report tabs, audience
 * chips) with small copy-paste drift between each. One definition here.
 */
export function ChipGroup<T>({
  options,
  value,
  onChange,
  scrollable = false,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}) {
  const row = (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={index}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
          >
            <Text className={`text-sm font-medium ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return row;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {row}
    </ScrollView>
  );
}
