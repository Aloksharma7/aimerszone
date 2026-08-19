import { NotificationFeed } from "@/components/notification-feed";
import { PageHeader } from "@/components/ui";
import { getStaffNotifications } from "@/lib/data/notifications";

export default async function StaffNotificationsPage() {
  const items = await getStaffNotifications();
  return (
    <>
      <PageHeader eyebrow="Updates" title="Notifications" description="Payments awaiting review and enrollment requests waiting on an admin decision." />
      <NotificationFeed items={items} emptyDescription="No payments or enrollment requests are waiting right now." />
    </>
  );
}
