import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppScreen } from "@/components/app-screen";
import { Button } from "@/components/button";
import { ChipGroup } from "@/components/chip-group";
import { ProofCapture, type CapturedProof } from "@/components/proof-capture";
import { DetailSkeleton } from "@/components/skeleton";
import { TextField } from "@/components/text-field";
import { isNormalizedApiError } from "@/lib/api/contracts";
import {
  deleteInstitutionFavicon,
  deleteInstitutionLogo,
  deletePaymentMethodQr,
  fetchAdminSettings,
  updateAdminSettings,
  uploadInstitutionFavicon,
  uploadInstitutionLogo,
  uploadPaymentMethodQr,
} from "@/lib/data/admin";
import type { AdminPaymentMethod, AdminSettings, FeatureStatus } from "@/types/lms";

/**
 * Named distinctly from the shared @/components/section.tsx (a bare title
 * with no card) — this is a genuinely different pattern: a titled, card-
 * wrapped group used to structure a very long settings form. Same name,
 * different component was the actual bug; different names for different
 * components is the fix.
 */
function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <View>
        <Text className="text-base font-bold text-slate-950">{title}</Text>
        {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function ToggleRow({ label, description, value, onValueChange }: { label: string; description?: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
      <View className="flex-1">
        <Text className="text-sm font-semibold text-slate-900">{label}</Text>
        {description ? <Text className="mt-0.5 text-xs text-slate-500">{description}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

type Values = {
  institution: AdminSettings["institution"];
  security: AdminSettings["security"];
  operations: AdminSettings["operations"];
  featureFlags: { singleDeviceLogin: boolean; dynamicWatermark: boolean; smsNotifications: boolean; esewaCheckout: boolean; studentSupportTickets: boolean; publicFreeCourses: boolean };
  sms: AdminSettings["sms"] & { token: string };
  esewa: AdminSettings["esewa"] & { secretKey: string };
  content: AdminSettings["content"];
  paymentMethods: AdminPaymentMethod[];
};

function toValues(data: AdminSettings): Values {
  return {
    institution: data.institution,
    security: data.security,
    operations: data.operations,
    featureFlags: {
      singleDeviceLogin: data.features.singleDeviceLogin.enabled,
      dynamicWatermark: data.features.dynamicWatermark.enabled,
      smsNotifications: data.features.smsNotifications.enabled,
      esewaCheckout: data.features.esewaCheckout.enabled,
      studentSupportTickets: data.features.studentSupportTickets.enabled,
      publicFreeCourses: data.features.publicFreeCourses.enabled,
    },
    sms: { ...data.sms, token: "" },
    esewa: { ...data.esewa, secretKey: "" },
    content: data.content,
    paymentMethods: data.paymentMethods,
  };
}

export default function AdminSettingsScreen() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: fetchAdminSettings });

  const [values, setValues] = useState<Values | null>(null);
  const [initializedFor, setInitializedFor] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);
  const [logoDraft, setLogoDraft] = useState<CapturedProof | null>(null);
  const [faviconDraft, setFaviconDraft] = useState<CapturedProof | null>(null);
  const [qrDraftByMethod, setQrDraftByMethod] = useState<Record<string, CapturedProof | null>>({});

  if (settings.data && !initializedFor) {
    setValues(toValues(settings.data));
    setInitializedFor(true);
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
  }

  const save = useMutation({
    mutationFn: () => {
      const v = values!;
      return updateAdminSettings({
        institution: {
          name: v.institution.name,
          short_name: v.institution.shortName || null,
          tagline: v.institution.tagline || null,
          primary_phone: v.institution.primaryPhone || null,
          support_email: v.institution.supportEmail || null,
          whatsapp: v.institution.whatsapp || null,
          website: v.institution.website || null,
          address: v.institution.address || null,
        },
        security: {
          public_registration: v.security.publicRegistration,
          email_verification: v.security.emailVerification,
          privileged_mfa: v.security.privilegedMfa,
          force_password_change: v.security.forcePasswordChange,
          session_timeout_hours: v.security.sessionTimeoutHours,
          failed_login_attempts: v.security.failedLoginAttempts,
          lockout_minutes: v.security.lockoutMinutes,
        },
        operations: {
          maintenance_notice: v.operations.maintenanceNotice,
          automatic_receipts: v.operations.automaticReceipts,
          daily_integration_health_check: v.operations.dailyIntegrationHealthCheck,
        },
        features: {
          single_device_login: v.featureFlags.singleDeviceLogin,
          dynamic_watermark: v.featureFlags.dynamicWatermark,
          sms_notifications: v.featureFlags.smsNotifications,
          esewa_checkout: v.featureFlags.esewaCheckout,
          student_support_tickets: v.featureFlags.studentSupportTickets,
          public_free_courses: v.featureFlags.publicFreeCourses,
        },
        sms: {
          provider: v.sms.provider,
          endpoint: v.sms.endpoint,
          sender_id: v.sms.senderId,
          token: v.sms.token || undefined,
          notify_class_starting: v.sms.notifyClassStarting,
          notify_payment_decision: v.sms.notifyPaymentDecision,
          notify_enrollment_activated: v.sms.notifyEnrollmentActivated,
        },
        esewa: { environment: v.esewa.environment, merchant_code: v.esewa.merchantCode, secret_key: v.esewa.secretKey || undefined },
        content: { watermark_opacity: v.content.watermarkOpacity, watermark_interval_seconds: v.content.watermarkIntervalSeconds },
        payment_methods: v.paymentMethods.map((method) => ({
          id: method.id,
          name: method.name,
          account_name: method.accountName,
          account_reference: method.accountReference,
          bank_name: method.bankName,
          branch: method.branch,
          status: method.status,
          sort_order: method.sortOrder,
        })),
      });
    },
    onSuccess: (data) => {
      setValues(toValues(data));
      setNotice({ tone: "success", message: "Configuration was saved and the change should appear in the audit log." });
    },
    onError: (err) => setNotice({ tone: "danger", message: isNormalizedApiError(err) ? err.message : "The request could not be completed." }),
  });

  const uploadLogo = useMutation({
    mutationFn: () => uploadInstitutionLogo(logoDraft!),
    onSuccess: () => {
      setLogoDraft(null);
      refresh();
    },
  });
  const removeLogo = useMutation({ mutationFn: deleteInstitutionLogo, onSuccess: refresh });
  const uploadFavicon = useMutation({
    mutationFn: () => uploadInstitutionFavicon(faviconDraft!),
    onSuccess: () => {
      setFaviconDraft(null);
      refresh();
    },
  });
  const removeFavicon = useMutation({ mutationFn: deleteInstitutionFavicon, onSuccess: refresh });

  const uploadQr = useMutation({
    mutationFn: (methodId: string) => uploadPaymentMethodQr(methodId, qrDraftByMethod[methodId]!),
    onSuccess: (_result, methodId) => {
      setQrDraftByMethod((current) => ({ ...current, [methodId]: null }));
      refresh();
    },
  });
  const removeQr = useMutation({ mutationFn: (methodId: string) => deletePaymentMethodQr(methodId), onSuccess: refresh });

  if (settings.isPending || !values) {
    return (
      <AppScreen edges={["bottom"]}>
        <DetailSkeleton rows={4} />
      </AppScreen>
    );
  }

  if (settings.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["bottom"]}>
        <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(settings.error) ? settings.error.message : "Something went wrong."}</Text>
        <View className="mt-4">
          <Button label="Try again" onPress={() => settings.refetch()} fullWidth={false} />
        </View>
      </SafeAreaView>
    );
  }

  function update<S extends keyof Values>(section: S, patch: Partial<Values[S]>) {
    setValues((current) => (current ? { ...current, [section]: { ...current[section], ...patch } } : current));
  }

  function updateMethod(id: string, patch: Partial<AdminPaymentMethod>) {
    setValues((current) =>
      current ? { ...current, paymentMethods: current.paymentMethods.map((method) => (method.id === id ? { ...method, ...patch } : method)) } : current,
    );
  }

  const featureRows: { key: keyof Values["featureFlags"]; label: string; status: FeatureStatus }[] = [
    { key: "singleDeviceLogin", label: "Single device login", status: settings.data.features.singleDeviceLogin },
    { key: "dynamicWatermark", label: "Dynamic watermark", status: settings.data.features.dynamicWatermark },
    { key: "smsNotifications", label: "SMS notifications", status: settings.data.features.smsNotifications },
    { key: "esewaCheckout", label: "eSewa checkout", status: settings.data.features.esewaCheckout },
    { key: "studentSupportTickets", label: "Student support tickets", status: settings.data.features.studentSupportTickets },
    { key: "publicFreeCourses", label: "Public free courses", status: settings.data.features.publicFreeCourses },
  ];

  return (
    <AppScreen edges={["bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          {notice ? (
            <View className={`rounded-xl p-3 ${notice.tone === "success" ? "bg-success-100" : "bg-danger-100"}`}>
              <Text className={`text-sm ${notice.tone === "success" ? "text-success-700" : "text-danger-700"}`}>{notice.message}</Text>
            </View>
          ) : null}

          <SettingsSection title="Institution branding">
            <TextField label="Name" value={values.institution.name} onChangeText={(v) => update("institution", { name: v })} />
            <TextField label="Short name" value={values.institution.shortName} onChangeText={(v) => update("institution", { shortName: v })} />
            <TextField label="Tagline" value={values.institution.tagline} onChangeText={(v) => update("institution", { tagline: v })} />
            <TextField label="Primary phone" value={values.institution.primaryPhone} onChangeText={(v) => update("institution", { primaryPhone: v })} keyboardType="phone-pad" />
            <TextField label="Support email" value={values.institution.supportEmail} onChangeText={(v) => update("institution", { supportEmail: v })} keyboardType="email-address" />
            <TextField label="WhatsApp" value={values.institution.whatsapp} onChangeText={(v) => update("institution", { whatsapp: v })} keyboardType="phone-pad" />
            <TextField label="Website" value={values.institution.website} onChangeText={(v) => update("institution", { website: v })} keyboardType="url" />
            <TextField label="Address" value={values.institution.address} onChangeText={(v) => update("institution", { address: v })} />

            <View className="gap-2">
              <Text className="text-sm font-semibold text-slate-700">Logo</Text>
              {values.institution.logoUrl ? (
                <View className="gap-2">
                  <Image source={{ uri: values.institution.logoUrl }} style={{ width: 120, height: 60, borderRadius: 8 }} contentFit="contain" />
                  <Button label="Remove" onPress={() => removeLogo.mutate()} loading={removeLogo.isPending} variant="secondary" size="md" icon="trash-2" fullWidth={false} />
                </View>
              ) : null}
              <ProofCapture value={logoDraft} onChange={setLogoDraft} label={values.institution.logoUrl ? "Replace logo" : "Upload logo"} />
              {logoDraft ? <Button label="Upload logo" onPress={() => uploadLogo.mutate()} loading={uploadLogo.isPending} /> : null}
            </View>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-slate-700">Favicon</Text>
              {values.institution.faviconUrl ? (
                <View className="gap-2">
                  <Image source={{ uri: values.institution.faviconUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="contain" />
                  <Button label="Remove" onPress={() => removeFavicon.mutate()} loading={removeFavicon.isPending} variant="secondary" size="md" icon="trash-2" fullWidth={false} />
                </View>
              ) : null}
              <ProofCapture value={faviconDraft} onChange={setFaviconDraft} label={values.institution.faviconUrl ? "Replace favicon" : "Upload favicon"} />
              {faviconDraft ? <Button label="Upload favicon" onPress={() => uploadFavicon.mutate()} loading={uploadFavicon.isPending} /> : null}
            </View>
          </SettingsSection>

          <SettingsSection title="Payment methods">
            {values.paymentMethods.map((method) => (
              <View key={method.id} className="gap-2 rounded-xl border border-slate-200 p-3">
                <TextField label="Name" value={method.name} onChangeText={(v) => updateMethod(method.id, { name: v })} />
                <TextField label="Account name" value={method.accountName ?? ""} onChangeText={(v) => updateMethod(method.id, { accountName: v })} />
                <TextField label="Account reference" value={method.accountReference ?? ""} onChangeText={(v) => updateMethod(method.id, { accountReference: v })} />
                <TextField label="Bank name" value={method.bankName ?? ""} onChangeText={(v) => updateMethod(method.id, { bankName: v })} />
                <TextField label="Branch" value={method.branch ?? ""} onChangeText={(v) => updateMethod(method.id, { branch: v })} />
                <ToggleRow
                  label="Active"
                  value={method.status === "active"}
                  onValueChange={(value) => updateMethod(method.id, { status: value ? "active" : "disabled" })}
                />
                {method.qrImageUrl ? (
                  <View className="gap-2">
                    <Image source={{ uri: method.qrImageUrl }} style={{ width: 100, height: 100, borderRadius: 8 }} contentFit="contain" />
                    <Button
                      label="Remove QR"
                      onPress={() => removeQr.mutate(method.id)}
                      loading={removeQr.isPending && removeQr.variables === method.id}
                      variant="secondary"
                      icon="trash-2"
                      fullWidth={false}
                    />
                  </View>
                ) : null}
                <ProofCapture
                  value={qrDraftByMethod[method.id] ?? null}
                  onChange={(proof) => setQrDraftByMethod((current) => ({ ...current, [method.id]: proof }))}
                  label={method.qrImageUrl ? "Replace QR image" : "Upload QR image"}
                />
                {qrDraftByMethod[method.id] ? (
                  <Button
                    label="Upload QR"
                    onPress={() => uploadQr.mutate(method.id)}
                    loading={uploadQr.isPending && uploadQr.variables === method.id}
                    fullWidth={false}
                  />
                ) : null}
              </View>
            ))}
          </SettingsSection>

          <SettingsSection title="Security policy">
            <ToggleRow label="Public registration" value={values.security.publicRegistration} onValueChange={(v) => update("security", { publicRegistration: v })} />
            <ToggleRow label="Email verification" value={values.security.emailVerification} onValueChange={(v) => update("security", { emailVerification: v })} />
            <ToggleRow
              label="Privileged MFA"
              description="Require two-factor authentication for admin and super admin accounts."
              value={values.security.privilegedMfa}
              onValueChange={(v) => update("security", { privilegedMfa: v })}
            />
            <ToggleRow label="Force password change" value={values.security.forcePasswordChange} onValueChange={(v) => update("security", { forcePasswordChange: v })} />
            <TextField
              label="Session timeout (hours, 1–24)"
              value={String(values.security.sessionTimeoutHours)}
              onChangeText={(v) => update("security", { sessionTimeoutHours: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <TextField
              label="Failed login attempts (3–20)"
              value={String(values.security.failedLoginAttempts)}
              onChangeText={(v) => update("security", { failedLoginAttempts: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <TextField
              label="Lockout minutes (5–1440)"
              value={String(values.security.lockoutMinutes)}
              onChangeText={(v) => update("security", { lockoutMinutes: Number(v) || 0 })}
              keyboardType="number-pad"
            />
          </SettingsSection>

          <SettingsSection title="Operations">
            <ToggleRow label="Maintenance notice" value={values.operations.maintenanceNotice} onValueChange={(v) => update("operations", { maintenanceNotice: v })} />
            <ToggleRow label="Automatic receipts" value={values.operations.automaticReceipts} onValueChange={(v) => update("operations", { automaticReceipts: v })} />
            <ToggleRow
              label="Daily integration health check"
              value={values.operations.dailyIntegrationHealthCheck}
              onValueChange={(v) => update("operations", { dailyIntegrationHealthCheck: v })}
            />
          </SettingsSection>

          <SettingsSection title="Feature flags" description="Each flag also reports whether it can actually run, not just whether it is switched on.">
            {featureRows.map((row) => (
              <View key={row.key} className="gap-1">
                <ToggleRow label={row.label} value={values.featureFlags[row.key]} onValueChange={(v) => update("featureFlags", { [row.key]: v } as Partial<Values["featureFlags"]>)} />
                {!row.status.ready ? (
                  <Text className="px-1 text-xs text-warning-700">Waiting on: {row.status.missing.join(", ")}</Text>
                ) : null}
              </View>
            ))}
          </SettingsSection>

          <SettingsSection title="SMS provider">
            <ChipGroup
              options={[
                { value: "sparrow" as const, label: "Sparrow" },
                { value: "generic" as const, label: "Generic" },
              ]}
              value={values.sms.provider}
              onChange={(provider) => update("sms", { provider })}
            />
            <TextField label="Endpoint" value={values.sms.endpoint} onChangeText={(v) => update("sms", { endpoint: v })} keyboardType="url" />
            <TextField label="Sender ID" value={values.sms.senderId} onChangeText={(v) => update("sms", { senderId: v })} />
            <TextField
              label={values.sms.tokenConfigured ? "Provider token (leave blank to keep the stored one)" : "Provider token"}
              value={values.sms.token}
              onChangeText={(v) => update("sms", { token: v })}
              secureTextEntry
            />
            <ToggleRow label="Notify on class starting" value={values.sms.notifyClassStarting} onValueChange={(v) => update("sms", { notifyClassStarting: v })} />
            <ToggleRow label="Notify on payment decision" value={values.sms.notifyPaymentDecision} onValueChange={(v) => update("sms", { notifyPaymentDecision: v })} />
            <ToggleRow label="Notify on enrollment activated" value={values.sms.notifyEnrollmentActivated} onValueChange={(v) => update("sms", { notifyEnrollmentActivated: v })} />
          </SettingsSection>

          <SettingsSection title="eSewa">
            <ChipGroup
              options={[
                { value: "sandbox" as const, label: "Sandbox" },
                { value: "live" as const, label: "Live" },
              ]}
              value={values.esewa.environment}
              onChange={(environment) => update("esewa", { environment })}
            />
            <TextField label="Merchant code" value={values.esewa.merchantCode} onChangeText={(v) => update("esewa", { merchantCode: v })} />
            <TextField
              label={values.esewa.secretKeyConfigured ? "Secret key (leave blank to keep the stored one)" : "Secret key"}
              value={values.esewa.secretKey}
              onChangeText={(v) => update("esewa", { secretKey: v })}
              secureTextEntry
            />
          </SettingsSection>

          <SettingsSection title="Content protection" description="Applies to recorded lecture playback.">
            <TextField
              label="Watermark opacity (5–60)"
              value={String(values.content.watermarkOpacity)}
              onChangeText={(v) => update("content", { watermarkOpacity: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <TextField
              label="Watermark interval seconds (4–120)"
              value={String(values.content.watermarkIntervalSeconds)}
              onChangeText={(v) => update("content", { watermarkIntervalSeconds: Number(v) || 0 })}
              keyboardType="number-pad"
            />
          </SettingsSection>

          <Button
            label="Save settings"
            loadingLabel="Saving…"
            loading={save.isPending}
            size="lg"
            onPress={() => {
              setNotice(null);
              save.mutate();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}
