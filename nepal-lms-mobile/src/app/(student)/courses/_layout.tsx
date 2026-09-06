import { Stack } from "expo-router";
import { STACK_HEADER_OPTIONS } from "@/constants/navigation";

/** Native-stack push/back from the course list into a course's workspace — see docs/CODING-STANDARDS.md on navigation. */
export default function CoursesStackLayout() {
  return (
    <Stack
      screenOptions={STACK_HEADER_OPTIONS}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[enrollmentId]/index" options={{ title: "Course" }} />
      <Stack.Screen name="[enrollmentId]/syllabus" options={{ title: "Syllabus" }} />
      <Stack.Screen name="[enrollmentId]/classes" options={{ title: "Classes" }} />
      <Stack.Screen name="[enrollmentId]/recordings" options={{ title: "Recordings" }} />
      <Stack.Screen name="[enrollmentId]/resources" options={{ title: "Resources" }} />
      <Stack.Screen name="[enrollmentId]/tests/index" options={{ title: "Tests" }} />
      <Stack.Screen name="[enrollmentId]/tests/[testId]/index" options={{ title: "Test" }} />
      <Stack.Screen name="[enrollmentId]/tests/[testId]/attempt" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="[enrollmentId]/tests/[testId]/result" options={{ title: "Result", headerBackVisible: false }} />
      <Stack.Screen name="[enrollmentId]/announcements" options={{ title: "Announcements" }} />
      <Stack.Screen name="explore/index" options={{ title: "Explore courses" }} />
      <Stack.Screen name="explore/[slug]/index" options={{ title: "Course" }} />
      <Stack.Screen name="explore/[slug]/pay" options={{ title: "Enroll" }} />
    </Stack>
  );
}
