import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const variantClasses = {
  primary: { container: "bg-brand-700 active:bg-brand-800", label: "text-white", spinner: "#ffffff" },
  secondary: { container: "border border-slate-300 bg-white active:bg-slate-100", label: "text-slate-800", spinner: "#1d4ed8" },
  danger: { container: "bg-danger-700 active:opacity-90", label: "text-white", spinner: "#ffffff" },
  "danger-outline": { container: "border border-danger-700 active:bg-danger-100", label: "text-danger-700", spinner: "#b91c1c" },
  ghost: { container: "active:bg-slate-100", label: "text-brand-700", spinner: "#1d4ed8" },
} as const;

const sizeClasses = {
  md: { container: "h-11 px-4", label: "text-sm" },
  lg: { container: "h-12 px-5", label: "text-base" },
} as const;

/**
 * The one CTA every screen should reach for. Generalizes AuthButton's
 * press-scale (mutating the shared value only inside useEffect — React
 * Compiler flags a direct `.value =` mutation inside an event-handler prop
 * as an immutability violation even though it's Reanimated's own documented
 * pattern) into the variants the rest of the app actually needs.
 */
export function Button({
  label,
  loadingLabel,
  loading = false,
  disabled = false,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  fullWidth = true,
}: {
  label: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
  icon?: keyof typeof Feather.glyphMap;
  fullWidth?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(pressed ? 0.97 : 1, { duration: pressed ? 90 : 140 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;
  const v = variantClasses[variant];
  const s = sizeClasses[size];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={animatedStyle}
      className={`${fullWidth ? "" : "self-start"} flex-row items-center justify-center gap-2 rounded-xl disabled:opacity-60 ${v.container} ${s.container}`}
    >
      {loading ? (
        <>
          <ActivityIndicator color={v.spinner} />
          <Text className={`font-bold ${v.label} ${s.label}`}>{loadingLabel ?? label}</Text>
        </>
      ) : (
        <>
          {icon ? <Feather name={icon} size={size === "lg" ? 18 : 16} color={v.spinner} /> : null}
          <Text className={`font-bold ${v.label} ${s.label}`}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}
