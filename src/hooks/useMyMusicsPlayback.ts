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

  const audioRef = useRef<HTMLAudioElement>(null);
  const preloadAudioRef = useRef<HTMLAudioElement>(null);
  const archiveStreamErrorsRef = useRef(0);
  const upNextRef = useRef<QueuedTrack | null>(null);
  const advanceStartedAtRef = useRef<number | null>(null);
  const reportedPlayRef = useRef(false);

  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [upNext, setUpNext] = useState<QueuedTrack | null>(null);
  const [status, setStatus] = useState<string>("");
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>("idle");
  const [history, setHistory] = useState<TrackInfo[]>([]);
  const [autoPlay, setAutoPlay] = useState(autoAdvanceInitial);
  const [healthWarn, setHealthWarn] = useState<string | null>(null);
  const [poolTrackCount, setPoolTrackCount] = useState<number | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);

  useEffect(() => {
    upNextRef.current = upNext;
  }, [upNext]);

  useEffect(() => {
    onTrackChange?.(track, streamUrl);
  }, [track, streamUrl, onTrackChange]);

  const applyTrack = useCallback(
    (info: TrackInfo, url: string, addHistory = true) => {
      setTrack(info);
      setStreamUrl(url);
      if (addHistory) setHistory((h) => [info, ...h].slice(0, 15));
    },
    [],
  );

  const playUrl = useCallback((url: string) => {
    const a = audioRef.current;
    if (!a) return;
    setPlaybackPhase("buffering");
    a.src = url;
    a.load();
    void a.play().catch(() => {
      setPlaybackPhase("error");
    });
  }, []);

  const preloadUrl = useCallback((url: string | null) => {
    const pre = preloadAudioRef.current;
    if (!pre || !url) return;
    if (pre.src === url) return;
    pre.src = url;
    pre.load();
  }, []);

  const refillUpNext = useCallback(async (excludeId: string) => {
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
  }, [preloadUrl]);

  const fetchTrackById = useCallback(async (id: string): Promise<RandomResponse | null> => {
    const res = await fetch(`/api/track/${encodeURIComponent(id)}`);
    const body = (await res.json()) as RandomResponse | ErrBody;
    if (!res.ok) return null;
    return body as RandomResponse;
  }, []);

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

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const vol = loadStoredVolume();
    if (vol !== null) a.volume = vol;
    if (startMuted) a.muted = true;
    const onVol = () => saveVolume(a.volume);
    a.addEventListener("volumechange", onVol);
    return () => a.removeEventListener("volumechange", onVol);
  }, [startMuted]);

  useEffect(() => {
    if (!autoplayOnMount) return;
    if (startTrackId) {
      void loadTrackById(startTrackId);
      return;
    }
    void advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount bootstrap
  }, []);

  const onEnded = useCallback(() => {
    if (autoPlay) void advance();
  }, [autoPlay, advance]);

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
    preloadAudioRef,
    track,
    streamUrl,
    upNext,
    status,
    playbackPhase,
    embedPlaybackState,
    history,
    autoPlay,
    setAutoPlay,
    healthWarn,
    poolTrackCount,
    queueBusy,
    requestNextTrack,
    loadTrackById,
    handleAudioPlaying,
    handleAudioError,
    handlePlay,
    handlePause,
    handleAudioPause,
    onEnded,
    showUpNextHint,
  };
}
