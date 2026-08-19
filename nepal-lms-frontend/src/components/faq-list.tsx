"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function FaqList({ items }: { items: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((item, index) => {
        const expanded = index === open;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
              aria-expanded={expanded}
            >
              <span className="font-semibold text-slate-900">{item.question}</span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? <p className="px-5 pb-5 pr-12 text-sm leading-7 text-slate-600 sm:px-6">{item.answer}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
