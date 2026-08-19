export type DestinationPurpose = "navigation" | "youtube_embed";

const DEFAULT_EXTERNAL_HOSTS = ["zoom.us", "youtube.com", "youtu.be", "youtube-nocookie.com"];
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,32}$/;

function configuredHosts(override?: string[]): string[] {
  if (override) return override.map((host) => host.trim().toLowerCase()).filter(Boolean);
  return (process.env.NEXT_PUBLIC_ALLOWED_EXTERNAL_HOSTS || DEFAULT_EXTERNAL_HOSTS.join(","))
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function hostAllowed(hostname: string, allowedHosts: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedHosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
}

function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return YOUTUBE_ID.test(id) ? id : null;
  }

  if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com")
  ) {
    const embedMatch = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,32})(?:\/|$)/);
    const id = embedMatch?.[1] || url.searchParams.get("v") || "";
    return YOUTUBE_ID.test(id) ? id : null;
  }

  return null;
}

/**
 * Accepts same-origin HTTP(S) destinations and explicitly allow-listed HTTPS hosts.
 * YouTube playback is normalized to the privacy-enhanced embed origin.
 */
export function trustedDestination(
  rawUrl: string,
  options: {
    currentOrigin: string;
    purpose?: DestinationPurpose;
    allowedHosts?: string[];
  },
): string | null {
  try {
    const currentOrigin = new URL(options.currentOrigin).origin;
    const url = new URL(rawUrl, currentOrigin);
    if (url.username || url.password) return null;

    if (url.origin === currentOrigin) {
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    }

    if (url.protocol !== "https:") return null;
    const allowedHosts = configuredHosts(options.allowedHosts);
    if (!hostAllowed(url.hostname, allowedHosts)) return null;

    if (options.purpose === "youtube_embed") {
      const videoId = youtubeVideoId(url);
      return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
    }

    return url.toString();
  } catch {
    return null;
  }
}
