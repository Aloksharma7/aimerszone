import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TicketThread } from "@/components/support/ticket-thread";
import { getSupportTicket } from "@/lib/data/support-inbox";

export default async function StudentTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const ticket = await getSupportTicket(ticketId);
  if (!ticket) notFound();

  return (
    <>
      <PageHeader back={{ href: "/student/support", label: "Support" }} eyebrow="Your request" title={ticket.reference} description={ticket.subject} />
      <TicketThread ticket={ticket} />
    </>
  );
}
