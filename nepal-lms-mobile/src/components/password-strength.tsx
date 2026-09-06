import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

const LEVELS = [
  { label: "Too short", color: "#cbd5e1" },
  { label: "Weak", color: "#b91c1c" },
  { label: "Fair", color: "#d97706" },
  { label: "Good", color: "#2563eb" },
  { label: "Strong", color: "#15803d" },
] as const;

/** 0–4. Purely a nudge toward a safer password — the real, enforced rule stays the 8-character zod minimum. */
function scorePassword(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <View className="-mt-1 gap-1.5">
      <View className="flex-row gap-1.5">
        {[0, 1, 2, 3].map((segment) => (
          <StrengthSegment key={segment} filled={segment < score} color={level.color} />
        ))}
      </View>
      <Text className="text-xs font-medium" style={{ color: level.color }}>
        {level.label}
      </Text>
    </View>
  );
}

function StrengthSegment({ filled, color }: { filled: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? color : "#e2e8f0", { duration: 200 }),
  }));

  return <Animated.View style={style} className="h-1.5 flex-1 rounded-full" />;
}
