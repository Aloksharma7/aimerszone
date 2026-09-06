import type { ReactNode } from "react";
import { View } from "react-native";
import { type Edge, SafeAreaView } from "react-native-safe-area-context";

/**
 * The tablet/desktop transformation, defined once. Every screen built on a
 * bare SafeAreaView had zero intentional tablet behavior — content either
 * stretched full-width on an iPad or left an untouched, unplanned gutter.
 * Swapping in AppScreen caps and centers content past the md breakpoint;
 * phones render exactly as before since the cap only applies at md:.
 *
 * Named AppScreen, not Screen — react-native-screens (a dependency of
 * React Navigation) declares its own global ambient `Screen` type, so a
 * component literally named `Screen` silently resolves to the wrong type
 * at every call site that doesn't shadow it with an explicit import.
 */
export function AppScreen({
  children,
  edges = ["top"],
  className = "",
}: {
  children: ReactNode;
  edges?: Edge[];
  className?: string;
}) {
  return (
    <SafeAreaView className={`flex-1 bg-canvas ${className}`} edges={edges}>
      <View className="w-full flex-1 self-center md:max-w-[720px]">{children}</View>
    </SafeAreaView>
  );
}
