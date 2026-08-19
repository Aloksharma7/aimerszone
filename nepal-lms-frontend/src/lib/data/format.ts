const nptDateTime = new Intl.DateTimeFormat("en-NP", {
  timeZone: "Asia/Kathmandu",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const nptDate = new Intl.DateTimeFormat("en-NP", {
  timeZone: "Asia/Kathmandu",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const nptTime = new Intl.DateTimeFormat("en-NP", {
  timeZone: "Asia/Kathmandu",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined, fallback = "Not set"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : nptDate.format(date);
}

export function formatDateTime(value: string | null | undefined, fallback = "Not set"): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : nptDateTime.format(date);
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startsAt}–${endsAt}`;
  return `${nptTime.format(start)}–${nptTime.format(end)}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 1) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}
