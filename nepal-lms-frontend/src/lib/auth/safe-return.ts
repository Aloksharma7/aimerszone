const disallowedPrefixes = ["//", "/\\"];

export function safeInternalPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || disallowedPrefixes.some((prefix) => value.startsWith(prefix))) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://lms.invalid");
    if (parsed.origin !== "https://lms.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
