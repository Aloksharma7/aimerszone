import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The primary call-to-action on both auth screens. A tiny press-scale gives
 * the button a physical feel instead of the instant, dead on/off state a
 * plain Pressable has — cheap to do since it's driven entirely on the UI
 * thread, and it's the single most-tapped element on either screen.
 *
 * The shared value is only ever mutated inside the effect (matching
 * skeleton.tsx's pattern) — React Compiler flags a direct `.value =`
 * mutation inside an event-handler prop as an immutability violation, even
 * though it's Reanimated's own documented usage.
 */
export function AuthButton({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withTiming(pressed ? 0.97 : 1, { duration: pressed ? 90 : 140 });
  }, [pressed, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={animatedStyle}
      className="mt-1 h-14 flex-row items-center justify-center rounded-2xl bg-brand-700 shadow-sm shadow-brand-900/20 active:bg-brand-800 disabled:opacity-60"
    >
      {loading ? (
        <>
          <ActivityIndicator color="#fff" />
          <Text className="ml-2 text-base font-bold text-white">{loadingLabel}</Text>
        </>
      ) : (
        <Text className="text-base font-bold text-white">{label}</Text>
      )}
    </AnimatedPressable>
  );
}
