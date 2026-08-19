import { NotificationFeed } from "@/components/notification-feed";
import { PageHeader } from "@/components/ui";
import { getTeacherNotifications } from "@/lib/data/notifications";

export default async function TeacherNotificationsPage() {
  const items = await getTeacherNotifications();
  return (
    <>
      <PageHeader eyebrow="Updates" title="Notifications" description="Pending attendance, unreleased recordings and draft tests across your assigned batches." />
      <NotificationFeed items={items} emptyDescription="Attendance is finalized, recordings are released and tests are published — nothing waiting on you right now." />
    </>
  );
}
