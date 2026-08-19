import { MessageCircle } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function WhatsAppButton({
  message = "Hello, I would like to know more about your courses.",
  whatsapp,
}: {
  message?: string;
  /** Administrator-managed number; falls back to the compiled-in default. */
  whatsapp?: string;
}) {
  const number = whatsapp || siteConfig.whatsapp;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-green-700 px-4 text-sm font-bold text-white shadow-float transition-transform hover:-translate-y-0.5 hover:bg-green-800 sm:bottom-6 sm:right-6"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
