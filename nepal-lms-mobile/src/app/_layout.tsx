import "@/global.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { queryClient } from "@/lib/query-client";
import { useSessionStore } from "@/lib/auth/session-store";
import { SideDrawer } from "@/components/side-drawer";

SplashScreen.preventAutoHideAsync();

/**
 * Foreground display behavior — without this, a push that arrives while the
 * app is open is silently swallowed instead of shown. Runs once at module
 * load, same as preventAutoHideAsync above.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const router = useRouter();
  const status = useSessionStore((state) => state.status);
  const hydrate = useSessionStore((state) => state.hydrate);

  useEffect(() => {
    hydrate().then(() => SplashScreen.hideAsync());
  }, [hydrate]);

  useEffect(() => {
    // Only "type" is ever branched on here — every notification sent (see
    // NotificationDispatcher) currently targets a student, so there is
    // nowhere else to route this yet.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === "payment.approved" || type === "payment.rejected") {
        router.push("/(student)/payments");
      } else if (type === "class.started") {
        router.push("/(student)/dashboard");
      }
    });

    return () => subscription.remove();
  }, [router]);

  if (status === "hydrating") return null;

  return (
    <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        {/*
          Not "auto": that follows the phone's system light/dark theme, but
          this app has no dark-mode support yet — every screen is always a
          light background. On a phone set to system dark mode, "auto" would
          pick light/white status-bar icons, which disappear against our
          permanently-light backgrounds. "dark" here means dark icons (the
          correct choice for a light background), not dark mode.
        */}
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(student)" />
          <Stack.Screen name="(teacher)" />
          <Stack.Screen name="(staff)" />
          <Stack.Screen name="(admin)" />
        </Stack>
        <SideDrawer />
      </QueryClientProvider>
    </KeyboardProvider>
  );
}
