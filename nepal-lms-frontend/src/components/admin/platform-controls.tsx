"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck } from "lucide-react";
import { browserRequest, createIdempotencyKey, type NormalizedApiError } from "@/lib/api/browser-client";
import type { AdminSettingsData, FeatureKey } from "@/lib/data/admin";
import { isMockDataEnabled } from "@/lib/data/config";

const featureCopy: Record<FeatureKey, { label: string; detail: string }> = {
  single_device_login: {
    label: "Single-device login",
    detail: "A student may be signed in on one device at a time. The strongest control against one purchased seat serving a whole study group.",
  },
  dynamic_watermark: {
    label: "Video watermark",
    detail: "Overlays the viewer's name and last four mobile digits on recordings, so a leaked capture names the account it came from.",
  },
  sms_notifications: {
    label: "SMS notifications",
    detail: "Sends class-started, payment and enrollment messages. Needs provider credentials below.",
  },
  esewa_checkout: {
    label: "eSewa online payment",
    detail: "Students pay through eSewa and are enrolled automatically. Without it, they upload a screenshot for manual review.",
  },
  student_support_tickets: {
    label: "Support tickets",
    detail: "Students can raise tickets from the portal. Turn off if you prefer phone and WhatsApp only.",
  },
  public_free_courses: {
    label: "Free course enrollment",
    detail: "Lets students join courses marked free without a payment step.",
  },
};

type Draft = {
  features: Record<FeatureKey, boolean>;
  sms: { provider: string; endpoint: string; senderId: string; token: string; notifyClassStarting: boolean; notifyPaymentDecision: boolean; notifyEnrollmentActivated: boolean };
  esewa: { environment: "sandbox" | "live"; merchantCode: string; secretKey: string };
  content: { watermarkOpacity: number; watermarkIntervalSeconds: number };
};

/**
 * Platform switches and the credentials they depend on.
 *
 * The panel deliberately separates "switched on" from "able to run": a feature
 * enabled without credentials is shown as waiting, with the missing items
 * named, rather than appearing to work and failing at the worst moment.
 *
 * Secrets are write-only. The API never returns a stored token, so the fields
 * start empty and an empty submission means "leave it alone" — saving after
 * editing a sender ID does not wipe the token.
 */
export function PlatformControls({ settings }: { settings: AdminSettingsData }) {
  const router = useRouter();
  const mockMode = isMockDataEnabled();

  const [draft, setDraft] = useState<Draft>({
    features: Object.fromEntries(
      (Object.keys(featureCopy) as FeatureKey[]).map((key) => [key, settings.features[key]?.enabled ?? false]),
    ) as Record<FeatureKey, boolean>,
    sms: { ...settings.sms, token: "" },
    esewa: { environment: settings.esewa.environment, merchantCode: settings.esewa.merchantCode, secretKey: "" },
    content: { ...settings.content },
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggle(key: FeatureKey, value: boolean) {
    setDraft((current) => ({ ...current, features: { ...current.features, [key]: value } }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      if (mockMode) {
        setNotice("Preview mode: nothing was saved.");
        return;
      }

      await browserRequest({
        url: "/api/v1/admin/settings",
        method: "PATCH",
        data: {
          features: draft.features,
          sms: {
            provider: draft.sms.provider,
            endpoint: draft.sms.endpoint,
            sender_id: draft.sms.senderId,
            // Empty means unchanged; the API keeps the stored secret.
            token: draft.sms.token,
            notify_class_starting: draft.sms.notifyClassStarting,
            notify_payment_decision: draft.sms.notifyPaymentDecision,
            notify_enrollment_activated: draft.sms.notifyEnrollmentActivated,
          },
          esewa: {
            environment: draft.esewa.environment,
            merchant_code: draft.esewa.merchantCode,
            secret_key: draft.esewa.secretKey,
          },
          content: {
            watermark_opacity: draft.content.watermarkOpacity,
            watermark_interval_seconds: draft.content.watermarkIntervalSeconds,
          },
        },
        headers: { "Idempotency-Key": createIdempotencyKey("platform-controls") },
      });

      setNotice("Saved. Changes take effect on the next request.");
      setDraft((current) => ({ ...current, sms: { ...current.sms, token: "" }, esewa: { ...current.esewa, secretKey: "" } }));
      router.refresh();
    } catch (caught) {
      const apiError = caught as Partial<NormalizedApiError>;
      setError(apiError.message || "The settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-950">Platform features</h2>
        <p className="mt-1 text-sm text-slate-600">Turn capabilities on and off without a deployment.</p>

        <div className="mt-4 grid gap-3">
          {(Object.keys(featureCopy) as FeatureKey[]).map((key) => {
            const status = settings.features[key];
            const waiting = draft.features[key] && status && !status.ready;

            return (
              <div key={key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{featureCopy[key].label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{featureCopy[key].detail}</p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.features[key]}
                      onChange={(event) => toggle(key, event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">{draft.features[key] ? "On" : "Off"}</span>
                  </label>
                </div>

                {waiting ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Switched on, but still waiting for: {status.missing.join(", ")}.</span>
                  </p>
                ) : null}

                {draft.features[key] && status?.ready ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Active
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-950">SMS provider</h2>
        <p className="mt-1 text-sm text-slate-600">
          Paste the credentials from your SMS provider. Email reaches few students here; SMS is how most will actually hear from you.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Provider</span>
            <select
              value={draft.sms.provider}
              onChange={(event) => setDraft((c) => ({ ...c, sms: { ...c.sms, provider: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="sparrow">Sparrow SMS</option>
              <option value="generic">Other (form post)</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Sender ID</span>
            <input
              value={draft.sms.senderId}
              onChange={(event) => setDraft((c) => ({ ...c, sms: { ...c.sms, senderId: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="TheAlert"
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-800">API endpoint</span>
            <input
              value={draft.sms.endpoint}
              onChange={(event) => setDraft((c) => ({ ...c, sms: { ...c.sms, endpoint: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              API token
              {settings.sms.tokenConfigured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Saved
                </span>
              ) : null}
            </span>
            <input
              type="password"
              value={draft.sms.token}
              onChange={(event) => setDraft((c) => ({ ...c, sms: { ...c.sms, token: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder={settings.sms.tokenConfigured ? "Leave blank to keep the saved token" : "Paste your provider token"}
              autoComplete="off"
            />
            <span className="text-xs text-slate-500">Stored encrypted and never shown again.</span>
          </label>
        </div>

        <div className="mt-4 grid gap-2">
          {([
            ["notifyClassStarting", "Tell students when a class actually starts"],
            ["notifyPaymentDecision", "Tell students when a payment is approved or rejected"],
            ["notifyEnrollmentActivated", "Tell students when their seat becomes active"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.sms[key]}
                onChange={(event) => setDraft((c) => ({ ...c, sms: { ...c.sms, [key]: event.target.checked } }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-950">eSewa</h2>
        <p className="mt-1 text-sm text-slate-600">
          With eSewa connected, a verified payment enrols the student automatically. The screenshot upload stays available as a fallback.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Environment</span>
            <select
              value={draft.esewa.environment}
              onChange={(event) => setDraft((c) => ({ ...c, esewa: { ...c.esewa, environment: event.target.value as "sandbox" | "live" } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
            >
              <option value="sandbox">Sandbox (testing)</option>
              <option value="live">Live (real money)</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Merchant code</span>
            <input
              value={draft.esewa.merchantCode}
              onChange={(event) => setDraft((c) => ({ ...c, esewa: { ...c.esewa, merchantCode: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder="EPAYTEST"
            />
          </label>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              Secret key
              {settings.esewa.secretKeyConfigured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" /> Saved
                </span>
              ) : null}
            </span>
            <input
              type="password"
              value={draft.esewa.secretKey}
              onChange={(event) => setDraft((c) => ({ ...c, esewa: { ...c.esewa, secretKey: event.target.value } }))}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm"
              placeholder={settings.esewa.secretKeyConfigured ? "Leave blank to keep the saved key" : "Paste your eSewa secret key"}
              autoComplete="off"
            />
            <span className="text-xs text-slate-500">
              This key verifies that a payment really came from eSewa. Without it, a student could fake a successful payment.
            </span>
          </label>
        </div>

        {draft.esewa.environment === "live" ? (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Live mode charges real money. Confirm a sandbox payment end to end before switching.</span>
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-950">Recording watermark</h2>
        <p className="mt-1 text-sm text-slate-600">
          Deterrence, not encryption: it makes a leaked recording traceable, which is what actually stops casual sharing.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Opacity — {draft.content.watermarkOpacity}%</span>
            <input
              type="range"
              min={5}
              max={60}
              value={draft.content.watermarkOpacity}
              onChange={(event) => setDraft((c) => ({ ...c, content: { ...c.content, watermarkOpacity: Number(event.target.value) } }))}
            />
            <span className="text-xs text-slate-500">Low enough to watch through, high enough to survive a screen recording.</span>
          </label>

          <label className="grid gap-1.5">
            <span className="text-sm font-semibold text-slate-800">Moves every {draft.content.watermarkIntervalSeconds}s</span>
            <input
              type="range"
              min={4}
              max={60}
              value={draft.content.watermarkIntervalSeconds}
              onChange={(event) => setDraft((c) => ({ ...c, content: { ...c.content, watermarkIntervalSeconds: Number(event.target.value) } }))}
            />
            <span className="text-xs text-slate-500">Moving it stops a single cropped screenshot producing a clean copy.</span>
          </label>
        </div>
      </section>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save platform settings
        </button>
      </div>
    </div>
  );
}
