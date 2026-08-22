import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { StatusBadge } from "@/components/status-badge";
import { isNormalizedApiError } from "@/lib/api/contracts";
import {
  fetchIntegrationEvents,
  fetchIntegrationRecords,
  fetchIntegrationStatus,
  performIntegrationAction,
  type IntegrationProvider,
} from "@/lib/data/admin";

const providers: { value: IntegrationProvider; label: string }[] = [
  { value: "zoom", label: "Zoom" },
  { value: "youtube", label: "YouTube" },
];

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  connected: "success",
  healthy: "success",
  disconnected: "neutral",
  disabled: "neutral",
  idle: "neutral",
  missing_credentials: "danger",
  degraded: "warning",
};

export default function AdminIntegrationsScreen() {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<IntegrationProvider>("zoom");
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({ queryKey: ["admin", "integration", provider, "status"], queryFn: () => fetchIntegrationStatus(provider) });
  const records = useQuery({ queryKey: ["admin", "integration", provider, "records"], queryFn: () => fetchIntegrationRecords(provider) });
  const events = useQuery({ queryKey: ["admin", "integration", provider, "events"], queryFn: () => fetchIntegrationEvents(provider) });

  const action = useMutation({
    mutationFn: (act: "connect" | "disconnect" | "health-check") => performIntegrationAction(provider, act),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "integration", provider] });
    },
    onError: (err) => setError(isNormalizedApiError(err) ? err.message : "The request could not be completed."),
  });

  function confirmDisconnect() {
    Alert.alert("Disconnect this provider?", "Existing local records are kept; only new activity through the provider stops.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => action.mutate("disconnect") },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <ScrollView contentContainerClassName="gap-4 px-5 py-6">
        <Text className="text-2xl font-bold text-slate-950">Integrations</Text>

        <View className="flex-row gap-2">
          {providers.map((option) => {
            const selected = provider === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  setProvider(option.value);
                  setError(null);
                }}
                className={`flex-1 items-center rounded-xl border px-3.5 py-2.5 ${selected ? "border-brand-700 bg-brand-700" : "border-slate-300 bg-white"}`}
              >
                <Text className={`text-sm font-bold ${selected ? "text-white" : "text-slate-700"}`}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {status.isPending ? (
          <ActivityIndicator color="#1d4ed8" />
        ) : status.isError ? (
          <Text className="text-sm text-danger-700">{isNormalizedApiError(status.error) ? status.error.message : "Something went wrong."}</Text>
        ) : (
          <View className="gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-bold text-slate-950">Connection status</Text>
              <StatusBadge label={status.data.status.replace(/_/g, " ")} tone={statusTone[status.data.status] ?? "neutral"} />
            </View>

            {status.data.missing.length > 0 ? (
              <View className="rounded-xl bg-danger-100 p-3">
                <Text className="text-sm font-semibold text-danger-700">Missing environment variables</Text>
                <Text className="mt-1 text-xs text-danger-700">{status.data.missing.join(", ")}</Text>
              </View>
            ) : null}

            {error ? (
              <View className="rounded-xl bg-danger-100 p-3">
                <Text className="text-sm text-danger-700">{error}</Text>
              </View>
            ) : null}

            <View className="flex-row flex-wrap gap-3">
              {status.data.connected ? (
                <Pressable
                  onPress={confirmDisconnect}
                  disabled={action.isPending}
                  className="h-10 flex-1 items-center justify-center rounded-xl border border-danger-300 active:bg-danger-100 disabled:opacity-60"
                >
                  <Text className="text-sm font-bold text-danger-700">Disconnect</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => action.mutate("connect")}
                  disabled={action.isPending || status.data.missing.length > 0}
                  className="h-10 flex-1 items-center justify-center rounded-xl bg-brand-700 active:bg-brand-800 disabled:opacity-60"
                >
                  <Text className="text-sm font-bold text-white">Connect</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => action.mutate("health-check")}
                disabled={action.isPending}
                className="h-10 flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 active:bg-slate-100 disabled:opacity-60"
              >
                {action.isPending ? <ActivityIndicator color="#1d4ed8" /> : <Feather name="activity" size={14} color="#1d4ed8" />}
                <Text className="text-sm font-bold text-brand-700">Health check</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text className="text-sm font-bold text-slate-900">Recent records</Text>
        {records.isPending ? (
          <ActivityIndicator color="#1d4ed8" />
        ) : (records.data ?? []).length === 0 ? (
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No records yet.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {records.data!.slice(0, 20).map((record, index) => (
              <View key={record.id ?? index} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                {Object.entries(record)
                  .filter(([key]) => key !== "id")
                  .map(([key, value]) => (
                    <View key={key} className="flex-row items-center justify-between py-0.5">
                      <Text className="text-xs capitalize text-slate-500">{key.replace(/_/g, " ")}</Text>
                      <Text className="text-xs font-medium text-slate-800" numberOfLines={1}>
                        {value}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </View>
        )}

        <Text className="text-sm font-bold text-slate-900">Recent events</Text>
        {events.isPending ? (
          <ActivityIndicator color="#1d4ed8" />
        ) : (events.data ?? []).length === 0 ? (
          <View className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <Text className="text-sm text-slate-500">No events recorded yet.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {events.data!.map((eventItem) => (
              <View key={eventItem.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-sm font-semibold text-slate-900">{eventItem.action}</Text>
                  <StatusBadge label={eventItem.status} tone={eventItem.status === "failed" ? "danger" : "success"} />
                </View>
                {eventItem.message ? <Text className="mt-1 text-xs text-slate-600">{eventItem.message}</Text> : null}
                <Text className="mt-1.5 text-xs text-slate-400">{eventItem.occurredAt}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
