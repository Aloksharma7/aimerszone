import { NotificationFeed } from "@/components/notification-feed";
import { PageHeader } from "@/components/ui";
import { getAdminNotifications } from "@/lib/data/notifications";

export default async function AdminNotificationsPage() {
  const items = await getAdminNotifications();
  return (
    <>
      <PageHeader eyebrow="Updates" title="Notifications" description="The same signals shown on the dashboard's attention panel — payments, attendance, integrations and draft batches." />
      <NotificationFeed items={items} emptyDescription="Nothing needs a decision right now." />
    </>
  );
}
