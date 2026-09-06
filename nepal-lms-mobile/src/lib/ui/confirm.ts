import { Alert } from "react-native";

/**
 * The one destructive-confirmation pattern for the whole app. Some screens
 * used a native Alert.alert for one destructive action and a hand-rolled
 * inline Yes/Cancel toggle for another right below it — same category of
 * action, two different interactions to learn. Alert.alert wins because it
 * matches each platform's own convention and needs no extra UI.
 */
export function confirmDestructive(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
