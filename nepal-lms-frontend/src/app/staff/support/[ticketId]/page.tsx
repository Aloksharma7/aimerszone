import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TicketThread } from "@/components/support/ticket-thread";
import { getSupportTicket } from "@/lib/data/support-inbox";
import { portalPath } from "@/lib/portal-path";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const [ticket, base] = await Promise.all([getSupportTicket(ticketId), portalPath("/staff/support")]);
  if (!ticket) notFound();

  return (
    <>
      <PageHeader
        back={{ href: base, label: "Support inbox" }}
        eyebrow="Support request"
        title={ticket.reference}
        description={[ticket.email, ticket.mobile].filter(Boolean).join(" · ") || undefined}
      />
      <TicketThread ticket={ticket} />
    </>
  );
}
