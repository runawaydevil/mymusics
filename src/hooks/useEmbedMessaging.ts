import { useCallback, useEffect } from "react";

import type { TrackInfo } from "./useMyMusicsPlayback";

export type EmbedPlaybackState = "playing" | "paused" | "buffering" | "error";

const PARENT_ORIGIN =
  typeof import.meta.env.VITE_EMBED_PARENT_ORIGIN === "string" &&
  import.meta.env.VITE_EMBED_PARENT_ORIGIN.trim()
    ? import.meta.env.VITE_EMBED_PARENT_ORIGIN.trim()
    : "*";

function post(type: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || window.parent === window) return;
  window.parent.postMessage({ source: "mymusics", type, ...payload }, PARENT_ORIGIN);
}

type Options = {
  enabled: boolean;
  trackCount: number | null;
  track: TrackInfo | null;
  streamUrl: string | null;
  playbackState: EmbedPlaybackState;
  onNext: () => void;
  onPlay: () => void;
  onPause: () => void;
};

export function useEmbedMessaging({
  enabled,
  trackCount,
  track,
  streamUrl,
  playbackState,
  onNext,
  onPlay,
  onPause,
}: Options) {
  useEffect(() => {
    if (!enabled) return;
    post("mymusics:ready", { trackCount });
  }, [enabled, trackCount]);

  useEffect(() => {
    if (!enabled || !track) return;
    post("mymusics:track", {
      id: track.id,
      title: track.title,
      artist: track.artist,
      streamUrl,
    });
  }, [enabled, track, streamUrl]);

  useEffect(() => {
    if (!enabled) return;
    post("mymusics:state", { state: playbackState });
  }, [enabled, playbackState]);

  const postError = useCallback(
    (code: string, message: string) => {
      if (!enabled) return;
      post("mymusics:error", { code, message });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { source?: string; type?: string; command?: string };
      if (data?.source !== "mymusics-host") return;
      if (PARENT_ORIGIN !== "*" && ev.origin !== PARENT_ORIGIN) return;
      if (data.type !== "mymusics:command") return;
      const cmd = data.command;
      if (cmd === "play") onPlay();
      else if (cmd === "pause") onPause();
      else if (cmd === "next") onNext();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, onNext, onPlay, onPause]);

  return { postError };
}
