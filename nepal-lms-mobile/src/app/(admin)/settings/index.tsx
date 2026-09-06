import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProofCapture, type CapturedProof } from "@/components/proof-capture";
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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
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

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secure,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "email-address" | "phone-pad" | "url" | "number-pad";
  secure?: boolean;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-slate-700">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType === "url" ? "default" : keyboardType}
        autoCapitalize="none"
        secureTextEntry={secure}
        className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900"
        placeholderTextColor="#94a3b8"
      />
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
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas" edges={["top"]}>
        <ActivityIndicator color="#1d4ed8" />
      </SafeAreaView>
    );
  }

  if (settings.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas px-6" edges={["top"]}>
        <Text className="text-center text-sm text-slate-600">{isNormalizedApiError(settings.error) ? settings.error.message : "Something went wrong."}</Text>
        <Pressable onPress={() => settings.refetch()} className="mt-4 h-11 items-center justify-center rounded-xl bg-brand-700 px-5 active:bg-brand-800">
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
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
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerClassName="gap-4 px-5 py-6">
          <Text className="text-2xl font-bold text-slate-950">Platform settings</Text>

          {notice ? (
            <View className={`rounded-xl p-3 ${notice.tone === "success" ? "bg-success-100" : "bg-danger-100"}`}>
              <Text className={`text-sm ${notice.tone === "success" ? "text-success-700" : "text-danger-700"}`}>{notice.message}</Text>
            </View>
          ) : null}

          <Section title="Institution branding">
            <Field label="Name" value={values.institution.name} onChangeText={(v) => update("institution", { name: v })} />
            <Field label="Short name" value={values.institution.shortName} onChangeText={(v) => update("institution", { shortName: v })} />
            <Field label="Tagline" value={values.institution.tagline} onChangeText={(v) => update("institution", { tagline: v })} />
            <Field label="Primary phone" value={values.institution.primaryPhone} onChangeText={(v) => update("institution", { primaryPhone: v })} keyboardType="phone-pad" />
            <Field label="Support email" value={values.institution.supportEmail} onChangeText={(v) => update("institution", { supportEmail: v })} keyboardType="email-address" />
            <Field label="WhatsApp" value={values.institution.whatsapp} onChangeText={(v) => update("institution", { whatsapp: v })} keyboardType="phone-pad" />
            <Field label="Website" value={values.institution.website} onChangeText={(v) => update("institution", { website: v })} keyboardType="url" />
            <Field label="Address" value={values.institution.address} onChangeText={(v) => update("institution", { address: v })} />

            <View className="gap-2">
              <Text className="text-sm font-semibold text-slate-700">Logo</Text>
              {values.institution.logoUrl ? (
                <View className="gap-2">
                  <Image source={{ uri: values.institution.logoUrl }} style={{ width: 120, height: 60, borderRadius: 8 }} contentFit="contain" />
                  <Pressable onPress={() => removeLogo.mutate()} className="h-9 w-32 flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-300 active:bg-slate-100">
                    {removeLogo.isPending ? <ActivityIndicator size="small" color="#64748b" /> : <Feather name="trash-2" size={14} color="#64748b" />}
                    <Text className="text-xs font-semibold text-slate-700">Remove</Text>
                  </Pressable>
                </View>
              ) : null}
              <ProofCapture value={logoDraft} onChange={setLogoDraft} label={values.institution.logoUrl ? "Replace logo" : "Upload logo"} />
              {logoDraft ? (
                <Pressable onPress={() => uploadLogo.mutate()} disabled={uploadLogo.isPending} className="h-10 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800">
                  {uploadLogo.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Upload logo</Text>}
                </Pressable>
              ) : null}
            </View>

            <View className="gap-2">
              <Text className="text-sm font-semibold text-slate-700">Favicon</Text>
              {values.institution.faviconUrl ? (
                <View className="gap-2">
                  <Image source={{ uri: values.institution.faviconUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="contain" />
                  <Pressable onPress={() => removeFavicon.mutate()} className="h-9 w-32 flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-300 active:bg-slate-100">
                    {removeFavicon.isPending ? <ActivityIndicator size="small" color="#64748b" /> : <Feather name="trash-2" size={14} color="#64748b" />}
                    <Text className="text-xs font-semibold text-slate-700">Remove</Text>
                  </Pressable>
                </View>
              ) : null}
              <ProofCapture value={faviconDraft} onChange={setFaviconDraft} label={values.institution.faviconUrl ? "Replace favicon" : "Upload favicon"} />
              {faviconDraft ? (
                <Pressable onPress={() => uploadFavicon.mutate()} disabled={uploadFavicon.isPending} className="h-10 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800">
                  {uploadFavicon.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Upload favicon</Text>}
                </Pressable>
              ) : null}
            </View>
          </Section>

          <Section title="Payment methods">
            {values.paymentMethods.map((method) => (
              <View key={method.id} className="gap-2 rounded-xl border border-slate-200 p-3">
                <Field label="Name" value={method.name} onChangeText={(v) => updateMethod(method.id, { name: v })} />
                <Field label="Account name" value={method.accountName ?? ""} onChangeText={(v) => updateMethod(method.id, { accountName: v })} />
                <Field label="Account reference" value={method.accountReference ?? ""} onChangeText={(v) => updateMethod(method.id, { accountReference: v })} />
                <Field label="Bank name" value={method.bankName ?? ""} onChangeText={(v) => updateMethod(method.id, { bankName: v })} />
                <Field label="Branch" value={method.branch ?? ""} onChangeText={(v) => updateMethod(method.id, { branch: v })} />
                <ToggleRow
                  label="Active"
                  value={method.status === "active"}
                  onValueChange={(value) => updateMethod(method.id, { status: value ? "active" : "disabled" })}
                />
                {method.qrImageUrl ? (
                  <View className="gap-2">
                    <Image source={{ uri: method.qrImageUrl }} style={{ width: 100, height: 100, borderRadius: 8 }} contentFit="contain" />
                    <Pressable onPress={() => removeQr.mutate(method.id)} className="h-9 w-32 flex-row items-center justify-center gap-1.5 rounded-lg border border-slate-300 active:bg-slate-100">
                      {removeQr.isPending && removeQr.variables === method.id ? (
                        <ActivityIndicator size="small" color="#64748b" />
                      ) : (
                        <Feather name="trash-2" size={14} color="#64748b" />
                      )}
                      <Text className="text-xs font-semibold text-slate-700">Remove QR</Text>
                    </Pressable>
                  </View>
                ) : null}
                <ProofCapture
                  value={qrDraftByMethod[method.id] ?? null}
                  onChange={(proof) => setQrDraftByMethod((current) => ({ ...current, [method.id]: proof }))}
                  label={method.qrImageUrl ? "Replace QR image" : "Upload QR image"}
                />
                {qrDraftByMethod[method.id] ? (
                  <Pressable
                    onPress={() => uploadQr.mutate(method.id)}
                    disabled={uploadQr.isPending}
                    className="h-9 flex-row items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800"
                  >
                    {uploadQr.isPending && uploadQr.variables === method.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-xs font-bold text-white">Upload QR</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ))}
          </Section>

          <Section title="Security policy">
            <ToggleRow label="Public registration" value={values.security.publicRegistration} onValueChange={(v) => update("security", { publicRegistration: v })} />
            <ToggleRow label="Email verification" value={values.security.emailVerification} onValueChange={(v) => update("security", { emailVerification: v })} />
            <ToggleRow
              label="Privileged MFA"
              description="Require two-factor authentication for admin and super admin accounts."
              value={values.security.privilegedMfa}
              onValueChange={(v) => update("security", { privilegedMfa: v })}
            />
            <ToggleRow label="Force password change" value={values.security.forcePasswordChange} onValueChange={(v) => update("security", { forcePasswordChange: v })} />
            <Field
              label="Session timeout (hours, 1–24)"
              value={String(values.security.sessionTimeoutHours)}
              onChangeText={(v) => update("security", { sessionTimeoutHours: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <Field
              label="Failed login attempts (3–20)"
              value={String(values.security.failedLoginAttempts)}
              onChangeText={(v) => update("security", { failedLoginAttempts: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <Field
              label="Lockout minutes (5–1440)"
              value={String(values.security.lockoutMinutes)}
              onChangeText={(v) => update("security", { lockoutMinutes: Number(v) || 0 })}
              keyboardType="number-pad"
            />
          </Section>

          <Section title="Operations">
            <ToggleRow label="Maintenance notice" value={values.operations.maintenanceNotice} onValueChange={(v) => update("operations", { maintenanceNotice: v })} />
            <ToggleRow label="Automatic receipts" value={values.operations.automaticReceipts} onValueChange={(v) => update("operations", { automaticReceipts: v })} />
            <ToggleRow
              label="Daily integration health check"
              value={values.operations.dailyIntegrationHealthCheck}
              onValueChange={(v) => update("operations", { dailyIntegrationHealthCheck: v })}
            />
          </Section>

          <Section title="Feature flags" description="Each flag also reports whether it can actually run, not just whether it is switched on.">
            {featureRows.map((row) => (
              <View key={row.key} className="gap-1">
                <ToggleRow label={row.label} value={values.featureFlags[row.key]} onValueChange={(v) => update("featureFlags", { [row.key]: v } as Partial<Values["featureFlags"]>)} />
                {!row.status.ready ? (
                  <Text className="px-1 text-xs text-warning-700">Waiting on: {row.status.missing.join(", ")}</Text>
                ) : null}
              </View>
            ))}
          </Section>

          <Section title="SMS provider">
            <View className="flex-row gap-2">
              {(["sparrow", "generic"] as const).map((option) => {
                const selected = values.sms.provider === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => update("sms", { provider: option })}
                    className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium capitalize ${selected ? "text-white" : "text-slate-700"}`}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Endpoint" value={values.sms.endpoint} onChangeText={(v) => update("sms", { endpoint: v })} keyboardType="url" />
            <Field label="Sender ID" value={values.sms.senderId} onChangeText={(v) => update("sms", { senderId: v })} />
            <Field
              label={values.sms.tokenConfigured ? "Provider token (leave blank to keep the stored one)" : "Provider token"}
              value={values.sms.token}
              onChangeText={(v) => update("sms", { token: v })}
              secure
            />
            <ToggleRow label="Notify on class starting" value={values.sms.notifyClassStarting} onValueChange={(v) => update("sms", { notifyClassStarting: v })} />
            <ToggleRow label="Notify on payment decision" value={values.sms.notifyPaymentDecision} onValueChange={(v) => update("sms", { notifyPaymentDecision: v })} />
            <ToggleRow label="Notify on enrollment activated" value={values.sms.notifyEnrollmentActivated} onValueChange={(v) => update("sms", { notifyEnrollmentActivated: v })} />
          </Section>

          <Section title="eSewa">
            <View className="flex-row gap-2">
              {(["sandbox", "live"] as const).map((option) => {
                const selected = values.esewa.environment === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => update("esewa", { environment: option })}
                    className={`rounded-full border px-3.5 py-2 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
                  >
                    <Text className={`text-sm font-medium capitalize ${selected ? "text-white" : "text-slate-700"}`}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label="Merchant code" value={values.esewa.merchantCode} onChangeText={(v) => update("esewa", { merchantCode: v })} />
            <Field
              label={values.esewa.secretKeyConfigured ? "Secret key (leave blank to keep the stored one)" : "Secret key"}
              value={values.esewa.secretKey}
              onChangeText={(v) => update("esewa", { secretKey: v })}
              secure
            />
          </Section>

          <Section title="Content protection" description="Applies to recorded lecture playback.">
            <Field
              label="Watermark opacity (5–60)"
              value={String(values.content.watermarkOpacity)}
              onChangeText={(v) => update("content", { watermarkOpacity: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <Field
              label="Watermark interval seconds (4–120)"
              value={String(values.content.watermarkIntervalSeconds)}
              onChangeText={(v) => update("content", { watermarkIntervalSeconds: Number(v) || 0 })}
              keyboardType="number-pad"
            />
          </Section>

          <Pressable
            onPress={() => {
              setNotice(null);
              save.mutate();
            }}
            disabled={save.isPending}
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
          >
            {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-bold text-white">Save settings</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
