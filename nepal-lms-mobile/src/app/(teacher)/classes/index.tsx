import { ClassesListScreen } from "@/components/classes/classes-list-screen";

export default function TeacherClassesScreen() {
  return <ClassesListScreen newHref="/(teacher)/classes/new" recurringHref="/(teacher)/classes/recurring" />;
}
