import { useCallback, useEffect, useRef, useState } from "react";

export type TrackInfo = {
  id: string;
  title: string;
  artist: string;
};

type RandomResponse = {
  track: TrackInfo;
  streamUrl: string;
};

export type QueuedTrack = TrackInfo & { streamUrl: string };

type ErrBody = { error?: string };

type HealthBody = {
  tracksReady?: boolean;
  hint?: string;
  metadataTsv?: string;
  metadataExists?: boolean;
  trackCount?: number;
};

const MAX_ARCHIVE_STREAM_ERRORS = 3;

export function useMyMusicsPlayback() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const archiveStreamErrorsRef = useRef(0);
  const upNextRef = useRef<QueuedTrack | null>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [upNext, setUpNext] = useState<QueuedTrack | null>(null);
  const [status, setStatus] = useState<string>("");
  const [history, setHistory] = useState<TrackInfo[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [healthWarn, setHealthWarn] = useState<string | null>(null);
  const [poolTrackCount, setPoolTrackCount] = useState<number | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);

  useEffect(() => {
    upNextRef.current = upNext;
  }, [upNext]);

  const playUrl = useCallback((url: string) => {
    const a = audioRef.current;
    if (!a) return;
    a.src = url;
    a.load();
    void a.play().catch(() => {});
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
      setUpNext({
        id: data.track.id,
        title: data.track.title,
        artist: data.track.artist,
        streamUrl: data.streamUrl,
      });
    } catch {
      setUpNext(null);
    } finally {
      setQueueBusy(false);
    }
  }, []);

  const advance = useCallback(async () => {
    setStatus("Loading…");
    const queued = upNextRef.current;
    try {
      if (queued) {
        const info: TrackInfo = {
          id: queued.id,
          title: queued.title,
          artist: queued.artist,
        };
        setTrack(info);
        setHistory((h) => [info, ...h].slice(0, 15));
        playUrl(queued.streamUrl);
        setUpNext(null);
        setStatus("");
        await refillUpNext(queued.id);
        return;
      }

      const res = await fetch("/api/track/random");
      const body = (await res.json()) as RandomResponse | ErrBody;
      if (!res.ok) {
        setTrack(null);
        setUpNext(null);
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
      setTrack(info);
      setHistory((h) => [info, ...h].slice(0, 15));
      playUrl(data.streamUrl);
      setStatus("");
      await refillUpNext(info.id);
    } catch {
      setStatus("Network error while requesting a track.");
      setUpNext(null);
    }
  }, [playUrl, refillUpNext]);

  const handleAudioPlaying = useCallback(() => {
    archiveStreamErrorsRef.current = 0;
    setStatus("");
  }, []);

  const handleAudioError = useCallback(() => {
    archiveStreamErrorsRef.current += 1;
    const n = archiveStreamErrorsRef.current;
    if (n >= MAX_ARCHIVE_STREAM_ERRORS) {
      setStatus(
        "Internet Archive could not stream several tracks in a row (e.g. 503). Try Next or wait.",
      );
      return;
    }
    setStatus("This track is not available from the Archive right now; trying another…");
    if (autoPlay) void advance();
  }, [autoPlay, advance]);

  const requestNextTrack = useCallback(() => {
    archiveStreamErrorsRef.current = 0;
    void advance();
  }, [advance]);

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

  useEffect(
    () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount bootstrap via advance()
      void advance();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
    [],
  );

  const onEnded = useCallback(() => {
    if (autoPlay) void advance();
  }, [autoPlay, advance]);

  const showUpNextHint =
    poolTrackCount === 1 && track && upNext && upNext.id === track.id;

  return {
    audioRef,
    track,
    upNext,
    status,
    history,
    autoPlay,
    setAutoPlay,
    healthWarn,
    poolTrackCount,
    queueBusy,
    requestNextTrack,
    handleAudioPlaying,
    handleAudioError,
    onEnded,
    showUpNextHint,
  };
}
