import { useCallback, useEffect, useRef, useState } from "react";

import { loadStoredVolume, saveVolume } from "../lib/playerStorage";
import { reportEvent } from "../lib/reportEvent";
import type { EmbedPlaybackState } from "./useEmbedMessaging";

export type TrackInfo = {
  id: string;
  title: string;
  artist: string;
};

export type QueuedTrack = TrackInfo & { streamUrl: string };

export type PlaybackPhase =
  | "idle"
  | "loading"
  | "buffering"
  | "playing"
  | "paused"
  | "error";

type RandomResponse = {
  track: TrackInfo;
  streamUrl: string;
};

type ErrBody = { error?: string };

type HealthBody = {
  tracksReady?: boolean;
  hint?: string;
  metadataTsv?: string;
  metadataExists?: boolean;
  trackCount?: number;
};

const MAX_ARCHIVE_STREAM_ERRORS = 3;

/** How many recently played tracks to keep in the history list. */
const HISTORY_LIMIT = 7;

export type PlaybackOptions = {
  /** Initial track id from URL ?track= or embed ?start= */
  startTrackId?: string | null;
  /** Mount with random/up-next (default true) */
  autoplayOnMount?: boolean;
  /** Auto-advance when track ends */
  autoAdvance?: boolean;
  /** Start muted (embed) */
  startMuted?: boolean;
  /** Callback when track/stream changes (embed messaging) */
  onTrackChange?: (track: TrackInfo | null, streamUrl: string | null) => void;
};

export function useMyMusicsPlayback(options: PlaybackOptions = {}) {
  const {
    startTrackId = null,
    autoplayOnMount = true,
    autoAdvance: autoAdvanceInitial = true,
    startMuted = false,
    onTrackChange,
  } = options;

  // Two audio elements: one plays while the other preloads the queued track, so
  // advancing swaps to already-buffered audio instead of re-downloading it.
  // `audioRef` always points at whichever element is currently active.
  const elARef = useRef<HTMLAudioElement>(null);
  const elBRef = useRef<HTMLAudioElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeIsBRef = useRef(false);
  const [audioGeneration, setAudioGeneration] = useState(0);

  const archiveStreamErrorsRef = useRef(0);
  const upNextRef = useRef<QueuedTrack | null>(null);
  const advanceStartedAtRef = useRef<number | null>(null);
  const reportedPlayRef = useRef(false);
  const mutedRef = useRef(startMuted);

  const historyRef = useRef<TrackInfo[]>([]);
  const cursorRef = useRef(0);

  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [upNext, setUpNext] = useState<QueuedTrack | null>(null);
  const [status, setStatus] = useState<string>("");
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>("idle");
  const [history, setHistory] = useState<TrackInfo[]>([]);
  /** Index into `history` of the currently playing track (0 = newest). */
  const [historyCursor, setHistoryCursor] = useState(0);
  const [autoPlay, setAutoPlay] = useState(autoAdvanceInitial);
  const [healthWarn, setHealthWarn] = useState<string | null>(null);
  const [poolTrackCount, setPoolTrackCount] = useState<number | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);

  const canGoPrev = history.length > historyCursor + 1;

  useEffect(() => {
    upNextRef.current = upNext;
  }, [upNext]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    onTrackChange?.(track, streamUrl);
  }, [track, streamUrl, onTrackChange]);

  const activeEl = useCallback(
    () => (activeIsBRef.current ? elBRef.current : elARef.current),
    [],
  );
  const inactiveEl = useCallback(
    () => (activeIsBRef.current ? elARef.current : elBRef.current),
    [],
  );

  const applyTrack = useCallback(
    (info: TrackInfo, url: string, addHistory = true) => {
      setTrack(info);
      setStreamUrl(url);
      if (addHistory) {
        // A brand-new track becomes the newest entry; reset the back/forward cursor.
        setHistory((h) => [info, ...h].slice(0, HISTORY_LIMIT));
        cursorRef.current = 0;
        setHistoryCursor(0);
      }
    },
    [],
  );

  /** Play `url` on the inactive element, then make it active (element swap). */
  const playUrl = useCallback(
    (url: string) => {
      const next = inactiveEl();
      const prev = activeEl();
      if (!next) return;
      setPlaybackPhase("buffering");
      // If the inactive element was preloaded with this url, playback is instant.
      if (next.src !== url) {
        next.src = url;
        next.load();
      }
      const vol = loadStoredVolume();
      if (vol !== null) next.volume = vol;
      next.muted = mutedRef.current;
      // Mark `next` active before pausing `prev` so the pause handler reads
      // the correct (playing) element and doesn't flip the phase to paused.
      activeIsBRef.current = !activeIsBRef.current;
      audioRef.current = next;
      void next.play().catch(() => {
        setPlaybackPhase("error");
      });
      if (prev && prev !== next) prev.pause();
      setAudioGeneration((g) => g + 1);
    },
    [activeEl, inactiveEl],
  );

  /** Warm the inactive element with the queued stream for an instant swap. */
  const preloadUrl = useCallback(
    (url: string | null) => {
      const pre = inactiveEl();
      if (!pre || !url) return;
      if (pre.src === url) return;
      pre.src = url;
      pre.load();
    },
    [inactiveEl],
  );

  const refillUpNext = useCallback(
    async (excludeId: string) => {
      setQueueBusy(true);
      try {
        const res = await fetch(
          `/api/track/up-next?exclude=${encodeURIComponent(excludeId)}`,
        );
        const body = (await res.json()) as RandomResponse | ErrBody;
        if (!res.ok) {
          setUpNext(null);
          return;
        }
        const data = body as RandomResponse;
        const queued: QueuedTrack = {
          id: data.track.id,
          title: data.track.title,
          artist: data.track.artist,
          streamUrl: data.streamUrl,
        };
        setUpNext(queued);
        preloadUrl(data.streamUrl);
      } catch {
        setUpNext(null);
      } finally {
        setQueueBusy(false);
      }
    },
    [preloadUrl],
  );

  const fetchTrackById = useCallback(
    async (id: string): Promise<RandomResponse | null> => {
      const res = await fetch(`/api/track/${encodeURIComponent(id)}`);
      const body = (await res.json()) as RandomResponse | ErrBody;
      if (!res.ok) return null;
      return body as RandomResponse;
    },
    [],
  );

  const advance = useCallback(async () => {
    setStatus("");
    setPlaybackPhase("loading");
    advanceStartedAtRef.current = Date.now();
    reportedPlayRef.current = false;

    const queued = upNextRef.current;
    try {
      if (queued) {
        const info: TrackInfo = {
          id: queued.id,
          title: queued.title,
          artist: queued.artist,
        };
        applyTrack(info, queued.streamUrl);
        playUrl(queued.streamUrl);
        setUpNext(null);
        await refillUpNext(queued.id);
        return;
      }

      const res = await fetch("/api/track/random");
      const body = (await res.json()) as RandomResponse | ErrBody;
      if (!res.ok) {
        setTrack(null);
        setStreamUrl(null);
        setUpNext(null);
        setPlaybackPhase("error");
        setStatus(
          "error" in body && body.error
            ? body.error
            : "Service unavailable. Try again later.",
        );
        return;
      }
      const data = body as RandomResponse;
      const info: TrackInfo = {
        id: data.track.id,
        title: data.track.title,
        artist: data.track.artist,
      };
      applyTrack(info, data.streamUrl);
      playUrl(data.streamUrl);
      await refillUpNext(info.id);
    } catch {
      setPlaybackPhase("error");
      setStatus("Network error while requesting a track.");
      setUpNext(null);
    }
  }, [applyTrack, playUrl, refillUpNext]);

  const loadTrackById = useCallback(
    async (id: string) => {
      setPlaybackPhase("loading");
      advanceStartedAtRef.current = Date.now();
      reportedPlayRef.current = false;
      setStatus("");
      try {
        const data = await fetchTrackById(id);
        if (!data) {
          setPlaybackPhase("error");
          setStatus("Track not found.");
          return;
        }
        const info: TrackInfo = {
          id: data.track.id,
          title: data.track.title,
          artist: data.track.artist,
        };
        applyTrack(info, data.streamUrl);
        playUrl(data.streamUrl);
        await refillUpNext(info.id);
      } catch {
        setPlaybackPhase("error");
        setStatus("Network error while loading track.");
      }
    },
    [applyTrack, fetchTrackById, playUrl, refillUpNext],
  );

  const goPrevious = useCallback(async () => {
    const h = historyRef.current;
    const idx = cursorRef.current + 1;
    // Nothing older than the current position.
    if (idx >= h.length) return;
    const prev = h[idx]!;

    setStatus("");
    setPlaybackPhase("loading");
    advanceStartedAtRef.current = Date.now();
    reportedPlayRef.current = false;
    try {
      const data = await fetchTrackById(prev.id);
      if (!data) {
        setPlaybackPhase("error");
        setStatus("Previous track is unavailable.");
        return;
      }
      const info: TrackInfo = {
        id: data.track.id,
        title: data.track.title,
        artist: data.track.artist,
      };
      // Walk back through history: update current track without re-adding to it.
      applyTrack(info, data.streamUrl, false);
      playUrl(data.streamUrl);
      cursorRef.current = idx;
      setHistoryCursor(idx);
      await refillUpNext(info.id);
    } catch {
      setPlaybackPhase("error");
      setStatus("Network error while loading previous track.");
    }
  }, [applyTrack, fetchTrackById, playUrl, refillUpNext]);

  const requestPrevTrack = useCallback(() => {
    archiveStreamErrorsRef.current = 0;
    void goPrevious();
  }, [goPrevious]);

  const handleAudioPlaying = useCallback(() => {
    archiveStreamErrorsRef.current = 0;
    setStatus("");
    setPlaybackPhase("playing");
    const started = advanceStartedAtRef.current;
    if (started !== null && !reportedPlayRef.current && track) {
      reportedPlayRef.current = true;
      reportEvent({
        type: "time_to_play",
        trackId: track.id,
        ms: Date.now() - started,
      });
    }
  }, [track]);

  const handleAudioError = useCallback(() => {
    archiveStreamErrorsRef.current += 1;
    setPlaybackPhase("error");
    if (track) {
      reportEvent({ type: "stream_error", trackId: track.id, detail: "audio_element_error" });
    }
    const n = archiveStreamErrorsRef.current;
    if (n >= MAX_ARCHIVE_STREAM_ERRORS) {
      setStatus(
        "Internet Archive could not stream several tracks in a row (e.g. 503). Try Next or wait.",
      );
      return;
    }
    setStatus("This track is not available from the Archive right now; trying another…");
    if (autoPlay) void advance();
  }, [autoPlay, advance, track]);

  const requestNextTrack = useCallback(() => {
    archiveStreamErrorsRef.current = 0;
    void advance();
  }, [advance]);

  const handleAudioPause = useCallback(() => {
    if (audioRef.current?.paused) setPlaybackPhase("paused");
  }, []);

  const handlePause = useCallback(() => {
    audioRef.current?.pause();
    setPlaybackPhase("paused");
  }, []);

  const handlePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    void a.play().catch(() => {});
  }, []);

  const onEnded = useCallback(() => {
    if (autoPlay) void advance();
  }, [autoPlay, advance]);

  // Bind media element events to whichever element is currently active. Rebinds
  // on every swap (audioGeneration) so handlers always follow the playing audio.
  useEffect(() => {
    const el = audioRef.current ?? elARef.current;
    if (!el) return;
    el.addEventListener("playing", handleAudioPlaying);
    el.addEventListener("pause", handleAudioPause);
    el.addEventListener("error", handleAudioError);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("playing", handleAudioPlaying);
      el.removeEventListener("pause", handleAudioPause);
      el.removeEventListener("error", handleAudioError);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioGeneration, handleAudioPlaying, handleAudioPause, handleAudioError, onEnded]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/health");
        const h = (await res.json()) as HealthBody;
        if (typeof h.trackCount === "number") setPoolTrackCount(h.trackCount);
        if (!h.tracksReady) {
          const parts = [
            h.hint,
            h.metadataTsv && `Path: ${h.metadataTsv}`,
            h.metadataExists === false && "File not found at configured path.",
            typeof h.trackCount === "number" && `Tracks loaded: ${h.trackCount}.`,
          ].filter(Boolean);
          setHealthWarn(
            parts.length > 0
              ? parts.join(" ")
              : "No tracks loaded. Check server metadata and /api/health.",
          );
        } else {
          setHealthWarn(null);
        }
      } catch {
        setHealthWarn(null);
      }
    })();
  }, []);

  // Initialise both elements' volume/mute once mounted.
  useEffect(() => {
    const vol = loadStoredVolume();
    for (const el of [elARef.current, elBRef.current]) {
      if (!el) continue;
      if (vol !== null) el.volume = vol;
      el.muted = startMuted;
    }
    mutedRef.current = startMuted;
  }, [startMuted]);

  // Persist volume and track mute state from the active element.
  useEffect(() => {
    const a = audioRef.current ?? elARef.current;
    if (!a) return;
    const onVol = () => {
      saveVolume(a.volume);
      mutedRef.current = a.muted;
    };
    a.addEventListener("volumechange", onVol);
    return () => a.removeEventListener("volumechange", onVol);
  }, [audioGeneration]);

  // Media Session API: OS/lock-screen metadata + hardware media keys.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (track) {
      try {
        ms.metadata = new MediaMetadata({
          title: track.title,
          artist: track.artist,
          album: "The Myspace Dragon Hoard",
          artwork: [{ src: "/mymusics.png", sizes: "200x80", type: "image/png" }],
        });
      } catch {
        /* MediaMetadata unsupported */
      }
    }
    ms.setActionHandler("play", () => handlePlay());
    ms.setActionHandler("pause", () => handlePause());
    ms.setActionHandler("nexttrack", () => requestNextTrack());
    ms.setActionHandler("previoustrack", () => {
      if (canGoPrev) requestPrevTrack();
    });
    return () => {
      ms.setActionHandler("play", null);
      ms.setActionHandler("pause", null);
      ms.setActionHandler("nexttrack", null);
      ms.setActionHandler("previoustrack", null);
    };
  }, [track, canGoPrev, handlePlay, handlePause, requestNextTrack, requestPrevTrack]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState =
      playbackPhase === "playing"
        ? "playing"
        : playbackPhase === "paused"
          ? "paused"
          : "none";
  }, [playbackPhase]);

  useEffect(() => {
    if (!autoplayOnMount) return;
    // Defer the initial load out of the effect body so the bootstrap doesn't
    // trigger a synchronous cascade of setState calls during commit.
    const id = setTimeout(() => {
      if (startTrackId) void loadTrackById(startTrackId);
      else void advance();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount bootstrap
  }, []);

  const showUpNextHint =
    poolTrackCount === 1 && track && upNext && upNext.id === track.id;

  const embedPlaybackState: EmbedPlaybackState =
    playbackPhase === "playing"
      ? "playing"
      : playbackPhase === "paused"
        ? "paused"
        : playbackPhase === "buffering" || playbackPhase === "loading"
          ? "buffering"
          : playbackPhase === "error"
            ? "error"
            : "paused";

  return {
    audioRef,
    audioElARef: elARef,
    audioElBRef: elBRef,
    audioGeneration,
    track,
    streamUrl,
    upNext,
    status,
    playbackPhase,
    embedPlaybackState,
    history,
    historyCursor,
    autoPlay,
    setAutoPlay,
    healthWarn,
    poolTrackCount,
    queueBusy,
    requestNextTrack,
    requestPrevTrack,
    canGoPrev,
    loadTrackById,
    handlePlay,
    handlePause,
    showUpNextHint,
  };
}
