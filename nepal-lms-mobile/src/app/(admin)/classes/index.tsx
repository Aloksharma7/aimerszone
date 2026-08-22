import { ClassesListScreen } from "@/components/classes/classes-list-screen";

export default function AdminClassesScreen() {
  return <ClassesListScreen newHref="/(admin)/classes/new" recurringHref="/(admin)/classes/recurring" />;
}
