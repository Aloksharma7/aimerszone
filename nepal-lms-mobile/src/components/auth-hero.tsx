import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const appIcon = require("@/assets/images/icon.png");

export function AuthHero({ title, subtitle, showBack }: { title: string; subtitle: string; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="relative overflow-hidden bg-brand-900" style={{ paddingTop: insets.top }}>
      <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
      <View className="absolute -left-16 top-10 h-32 w-32 rounded-full bg-white/5" />

      {showBack ? (
        <Pressable
          onPress={() => router.back()}
          className="ml-4 mt-2 h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <Feather name="arrow-left" size={18} color="#fff" />
        </Pressable>
      ) : null}

      <View className={`items-center gap-3 px-6 ${showBack ? "pb-10 pt-2" : "pb-10 pt-12"}`}>
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/15">
          <Image source={appIcon} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </View>
        <View className="items-center">
          <Text className="text-2xl font-extrabold text-white">{title}</Text>
          <Text className="mt-1 text-center text-sm leading-5 text-white/70">{subtitle}</Text>
        </View>
      </View>
    </View>
  );
}
