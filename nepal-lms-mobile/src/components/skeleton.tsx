import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

/**
 * Shown in place of a spinner while a screen's first fetch is in flight — the
 * eye starts parsing the layout before data arrives, which reads as faster
 * than a spinner even at the same wait time. See docs/CODING-STANDARDS.md.
 */
function Bone({ width, height, radius = 6 }: { width: number | `${number}%`; height: number; radius?: number }) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 650 }), withTiming(0.5, { duration: 650 })), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: "#e2e8f0" }, style]} />;
}

export function CardSkeleton({ withThumbnail = true }: { withThumbnail?: boolean }) {
  return (
    <View className="flex-row gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      {withThumbnail ? <Bone width={56} height={56} radius={12} /> : null}
      <View className="flex-1 gap-2">
        <Bone width="70%" height={13} />
        <Bone width="45%" height={11} />
        <Bone width="90%" height={8} radius={4} />
      </View>
    </View>
  );
}

export function ListSkeleton({ count = 4, withThumbnail = true }: { count?: number; withThumbnail?: boolean }) {
  return (
    <View className="gap-3 px-5 py-6">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} withThumbnail={withThumbnail} />
      ))}
    </View>
  );
}

/**
 * A pushed detail screen's first fetch used a bare centered spinner in most
 * places while list screens got the shaped skeleton above — two different
 * loading vocabularies for the same "waiting on the network" moment. This
 * shapes itself like a typical detail screen (header card + a few rows)
 * instead.
 */
export function DetailSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-4 px-5 py-6">
      <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <Bone width="55%" height={16} />
        <Bone width="35%" height={11} />
      </View>
      <View className="flex-row gap-3">
        <Bone width="31%" height={64} radius={16} />
        <Bone width="31%" height={64} radius={16} />
        <Bone width="31%" height={64} radius={16} />
      </View>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className="gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <Bone width="70%" height={13} />
          <Bone width="90%" height={11} />
        </View>
      ))}
    </View>
  );
}
