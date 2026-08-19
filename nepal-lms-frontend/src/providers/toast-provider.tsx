"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";

export type ToastTone = "success" | "danger" | "info";

export type ToastOptions = {
  tone?: ToastTone;
  title: string;
  message?: string;
  /** Milliseconds before it auto-dismisses. 0 keeps it until closed manually. */
  duration?: number;
};

type Toast = ToastOptions & { id: number };

type ToastContextValue = {
  toast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyle: Record<ToastTone, { icon: React.ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />, className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  danger: { icon: <TriangleAlert className="h-5 w-5 shrink-0 text-red-600" />, className: "border-red-200 bg-red-50 text-red-900" },
  info: { icon: <Loader2 className="h-5 w-5 shrink-0 text-brand-700" />, className: "border-slate-200 bg-white text-slate-900" },
};

/**
 * Global, automatic, hard-to-miss confirmation for save/create/delete actions.
 *
 * The inline "small green box" pattern used across the app requires the
 * person to notice it themselves and doesn't move — for staff who are not
 * technical, that reads as "nothing happened," not as confirmation. A toast
 * appears on its own, in the same place every time, and goes away on its own.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      const duration = options.duration ?? 5000;
      setToasts((current) => [...current, { ...options, id }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((item) => {
          const tone = item.tone ?? "info";
          const style = toneStyle[tone];
          return (
            <div
              key={item.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg animate-[toast-in_0.2s_ease-out] ${style.className}`}
            >
              {style.icon}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{item.title}</p>
                {item.message ? <p className="mt-0.5 text-sm leading-5 opacity-90">{item.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Falls back to a no-op outside the provider instead of throwing, so a
 * component doesn't crash the page if it's ever rendered somewhere the
 * provider hasn't mounted yet (e.g. an isolated test).
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return context ?? { toast: () => {} };
}
