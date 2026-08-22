import { NotificationFeed } from "@/components/notification-feed";
import { PageHeader } from "@/components/ui";
import { getStaffNotifications } from "@/lib/data/notifications";

export default async function StaffNotificationsPage() {
  const items = await getStaffNotifications();
  return (
    <>
      <PageHeader eyebrow="Updates" title="Notifications" description="Payments awaiting a second review." />
      <NotificationFeed items={items} emptyDescription="No payments are waiting right now." />
    </>
  );
}
