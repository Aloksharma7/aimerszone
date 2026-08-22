import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SettingsRow } from "@/components/settings-row";
import { ListSkeleton } from "@/components/skeleton";
import { SignOutButton } from "@/components/sign-out-button";
import { IMAGE_PLACEHOLDER_BLURHASH } from "@/constants/config";
import { isNormalizedApiError } from "@/lib/api/contracts";
import { fetchAccountProfile } from "@/lib/data/account";

/** Reused by every portal's Profile tab — Account endpoints are role-agnostic (see app/Http/Controllers/Api/V1/Account/*.php). */
export function ProfileOverviewScreen({ basePath, supportPath }: { basePath: string; supportPath?: string }) {
  const router = useRouter();
  const profile = useQuery({ queryKey: ["account", "profile"], queryFn: fetchAccountProfile });

  if (profile.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <ListSkeleton count={5} withThumbnail={false} />
      </SafeAreaView>
    );
  }

  if (profile.isError) {
    const message = isNormalizedApiError(profile.error) ? profile.error.message : "Something went wrong.";
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{message}</Text>
        <Pressable onPress={() => profile.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const data = profile.data;
  const initials = data.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView contentContainerClassName="gap-6 px-5 py-6">
        <View className="items-center gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          {data.avatarUrl ? (
            <Image
              source={{ uri: data.avatarUrl }}
              placeholder={{ blurhash: IMAGE_PLACEHOLDER_BLURHASH }}
              style={{ width: 72, height: 72, borderRadius: 36 }}
              contentFit="cover"
            />
          ) : (
            <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-700">
              <Text className="text-2xl font-bold text-white">{initials}</Text>
            </View>
          )}
          <View className="items-center">
            <Text className="text-lg font-bold text-slate-950">{data.name}</Text>
            {data.identityCode ? <Text className="mt-0.5 text-xs text-slate-500">{data.identityCode}</Text> : null}
            <Text className="mt-0.5 text-xs text-slate-500">{data.email || data.mobile}</Text>
          </View>
        </View>

        <View className="gap-3">
          <SettingsRow icon="user" label="Edit profile" detail="Name, email, mobile number" onPress={() => router.push(`${basePath}/edit` as never)} />
          <SettingsRow icon="lock" label="Change password" onPress={() => router.push(`${basePath}/password` as never)} />
          <SettingsRow
            icon="shield"
            label="Two-factor authentication"
            detail={data.twoFactorEnabled ? "Enabled" : "Not enabled"}
            onPress={() => router.push(`${basePath}/two-factor` as never)}
          />
          <SettingsRow
            icon="smartphone"
            label="Active sessions"
            detail={`${data.sessions.length} device${data.sessions.length === 1 ? "" : "s"} signed in`}
            onPress={() => router.push(`${basePath}/sessions` as never)}
          />
          {supportPath ? <SettingsRow icon="help-circle" label="Help & support" onPress={() => router.push(supportPath as never)} /> : null}
        </View>

        <View className="mt-2">
          <SignOutButton />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
