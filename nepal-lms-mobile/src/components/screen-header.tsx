import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { DrawerMenuButton } from "@/components/side-drawer";

/**
 * The one header every tab-root screen uses: hamburger → side drawer, an
 * optional eyebrow (portal label), the screen title, and an optional
 * right-side slot for a page-specific action (bell, add button). Pushed
 * detail screens don't use this — they get a native Stack header with a
 * back button instead (see STACK_HEADER_OPTIONS), which is the standard
 * split: a drawer/hamburger belongs at the top of a stack, not partway in.
 */
export function ScreenHeader({ title, eyebrow, right }: { title: string; eyebrow?: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 flex-row items-center gap-2">
        <DrawerMenuButton />
        <View className="flex-1">
          {eyebrow ? <Text className="text-xs font-bold uppercase tracking-wide text-brand-700">{eyebrow}</Text> : null}
          <Text className={`text-2xl font-bold text-slate-950 ${eyebrow ? "mt-0.5" : ""}`} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>
      {right ? <View className="flex-row items-center gap-2">{right}</View> : null}
    </View>
  );
}
