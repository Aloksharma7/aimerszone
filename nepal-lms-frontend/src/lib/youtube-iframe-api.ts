"use client";

/**
 * Minimal ambient types for the one YouTube IFrame Player API surface this
 * app actually uses. Not a security boundary — see custom-youtube-player.tsx
 * for why a custom-controls player is cosmetic only.
 */
export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): YTPlayerState;
  isMuted(): boolean;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  destroy(): void;
}

export interface YTPlayerOptions {
  videoId: string;
  host?: string;
  width?: string;
  height?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: YTPlayerState; target: YTPlayer }) => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Injects the IFrame API script at most once per page load, however many players mount. */
export function ensureYoutubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();

  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(script);
    });
  }

  return apiPromise;
}
