import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const appIcon = require("@/assets/images/icon.png");

export function AuthHero({ title, subtitle, showBack }: { title: string; subtitle: string; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="relative overflow-hidden rounded-b-[36px] bg-brand-900" style={{ paddingTop: insets.top }}>
      {/* Layered, softly-glowing shapes stand in for an illustration/gradient
          asset this app doesn't have — cheap on both bundle size and paint
          cost since they're just translucent Views, not images. */}
      <View className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/[0.07]" />
      <View className="absolute -left-10 top-16 h-28 w-28 rounded-full bg-white/[0.06]" />
      <View className="absolute right-10 top-24 h-3 w-3 rounded-full bg-accent-600/70" />
      <View className="absolute left-16 top-8 h-2 w-2 rounded-full bg-white/40" />

      {showBack ? (
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="ml-4 mt-2 h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
      ) : null}

      <Animated.View
        entering={FadeIn.duration(380)}
        className={`items-center gap-3 px-6 ${showBack ? "pb-14 pt-2" : "pb-14 pt-12"}`}
      >
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/15 shadow-lg shadow-black/20">
          <Image source={appIcon} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </View>
        <View className="items-center">
          <Text className="text-2xl font-extrabold tracking-tight text-white">{title}</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-white/70">{subtitle}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
