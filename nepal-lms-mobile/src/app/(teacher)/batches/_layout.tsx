import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

export default function TeacherBatchesStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[batchId]/index" options={{ title: "Batch" }} />
      <Stack.Screen name="[batchId]/recordings/index" options={{ title: "Recordings" }} />
      <Stack.Screen name="[batchId]/recordings/new" options={{ title: "Add recording" }} />
      <Stack.Screen name="[batchId]/resources/index" options={{ title: "Resources" }} />
      <Stack.Screen name="[batchId]/resources/new" options={{ title: "Upload resource" }} />
      <Stack.Screen name="[batchId]/tests/index" options={{ title: "Tests" }} />
      <Stack.Screen name="[batchId]/tests/new" options={{ title: "New test" }} />
      <Stack.Screen name="[batchId]/tests/[testId]" options={{ title: "Test results" }} />
    </Stack>
  );
}
