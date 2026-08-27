"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ensureYoutubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe-api";
import { cn } from "@/lib/utils";

const PLAYER_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Site-branded playback controls in place of YouTube's own control bar.
 *
 * This is cosmetic, not a security boundary. The YouTube IFrame API still
 * creates a real iframe pointed at the video id underneath — inspecting the
 * page reveals the id exactly as it would with the native player. Nothing
 * here makes the video harder to reach outside this page than before;
 * that gap is closed only by not hosting on YouTube at all.
 */
export function CustomYoutubePlayer({ videoId, title }: { videoId: string; title: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ensureYoutubeIframeApi().then(() => {
      if (cancelled || !mountRef.current || !window.YT) return;

      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: { controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, disablekb: 1, playsinline: 1, fs: 0 },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
          },
          onStateChange: (event) => {
            if (cancelled) return;
            setPlaying(event.data === PLAYER_STATE.PLAYING);
            setBuffering(event.data === PLAYER_STATE.BUFFERING);
            if (event.data === PLAYER_STATE.PLAYING) setDuration(event.target.getDuration());
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!ready || seeking) return;
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      setCurrentTime(player.getCurrentTime());
    }, 250);
    return () => window.clearInterval(timer);
  }, [ready, seeking]);

  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function togglePlay() {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }

  function toggleMute() {
    const player = playerRef.current;
    if (!player) return;
    if (muted || player.isMuted()) {
      player.unMute();
      setMuted(false);
    } else {
      player.mute();
      setMuted(true);
    }
  }

  function changeVolume(value: number) {
    const player = playerRef.current;
    if (!player) return;
    player.setVolume(value);
    setVolume(value);
    if (value === 0) {
      player.mute();
      setMuted(true);
    } else if (muted) {
      player.unMute();
      setMuted(false);
    }
  }

  function seekTo(value: number) {
    setCurrentTime(value);
    playerRef.current?.seekTo(value, true);
  }

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await containerRef.current.requestFullscreen();
  }

  return (
    <div ref={containerRef} className="group relative h-full w-full bg-black">
      <div ref={mountRef} className="pointer-events-none absolute inset-0" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <LoaderCircle className="h-8 w-8 animate-spin" />
        </div>
      ) : null}

      {/* Transparent hit-target over the iframe — the iframe itself can't be clicked through, so play/pause is driven from here instead. */}
      <button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full cursor-pointer"
      >
        {ready && !playing && !buffering ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white">
              <Play className="ml-1 h-7 w-7" />
            </span>
          </span>
        ) : null}
        {buffering ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-white/80" />
          </span>
        ) : null}
      </button>

      <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-8" onClick={(event) => event.stopPropagation()}>
        <input
          type="range"
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={currentTime}
          onChange={(event) => seekTo(Number(event.target.value))}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
          onTouchStart={() => setSeeking(true)}
          onTouchEnd={() => setSeeking(false)}
          aria-label={`Seek ${title}`}
          className="video-seek-bar h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-brand-500"
        />
        <div className="mt-2 flex items-center gap-3 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="shrink-0">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} className="shrink-0">
            {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={muted ? 0 : volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            aria-label="Volume"
            className="video-seek-bar hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/25 accent-brand-500 sm:block"
          />
          <span className="whitespace-nowrap text-xs font-medium tabular-nums text-white/90">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} className={cn("shrink-0", "opacity-90 hover:opacity-100")}>
            {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
