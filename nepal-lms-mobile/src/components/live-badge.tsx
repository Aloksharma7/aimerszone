import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

/** A slow pulse on the dot signals "this is happening right now," not just a static label — shown only when a session can actually be joined/started this instant. */
export function LiveBadge() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true);
  }, [opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-white/15 px-2.5 py-1">
      <Animated.View style={dotStyle} className="h-1.5 w-1.5 rounded-full bg-danger-400" />
      <Text className="text-[10px] font-bold uppercase tracking-wide text-white">Live now</Text>
    </View>
  );
}
