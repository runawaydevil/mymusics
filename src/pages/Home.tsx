import { useCallback, useEffect, useRef, useState } from "react";
import { CozyAudioBar } from "../components/CozyAudioBar";
import { SiteHeader } from "../components/SiteHeader";
import "../App.css";

type TrackInfo = {
  id: string;
  title: string;
  artist: string;
};

type RandomResponse = {
  track: TrackInfo;
  streamUrl: string;
};

type QueuedTrack = TrackInfo & { streamUrl: string };

type ErrBody = { error?: string };

type HealthBody = {
  tracksReady?: boolean;
  hint?: string;
  metadataTsv?: string;
  metadataExists?: boolean;
  trackCount?: number;
};

const MAX_ARCHIVE_STREAM_ERRORS = 3;

export default function Home() {
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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount bootstrap via advance()
    void advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const onEnded = () => {
    if (autoPlay) void advance();
  };

  const showUpNextHint =
    poolTrackCount === 1 && track && upNext && upNext.id === track.id;

  return (
    <div className="page">
      {healthWarn ? (
        <div className="health-banner" role="alert">
          <strong>Server metadata</strong>
          <p>{healthWarn}</p>
          <p className="health-banner-hint">
            On the host, run <code>curl -sS http://127.0.0.1:38471/api/health</code> (adjust
            port) and fix <code>METADATA_TSV</code> or remove it to use the default{" "}
            <code>data/metadata.tsv</code>.
          </p>
        </div>
      ) : null}
      <SiteHeader nav="home" />

      <main className="main">
        <article className="card now-playing">
          <header className="card-head">
            <h2>Now playing</h2>
          </header>
          {track ? (
            <div className="track-block">
              <p className="artist">{track.artist}</p>
              <p className="title">{track.title}</p>
            </div>
          ) : (
            <p className="muted">{status || "No track loaded."}</p>
          )}

          <section className="up-next" aria-label="Up next">
            <h3 className="up-next-label">Up next</h3>
            {upNext ? (
              <>
                <p className="up-next-track">
                  <span className="up-next-artist">{upNext.artist}</span>
                  <span className="up-next-sep"> — </span>
                  <span className="up-next-title">{upNext.title}</span>
                </p>
                {showUpNextHint ? (
                  <p className="up-next-note muted">Only one track in the pool — it will repeat.</p>
                ) : null}
              </>
            ) : queueBusy ? (
              <p className="up-next-empty muted">Queuing…</p>
            ) : track ? (
              <p className="up-next-empty muted">—</p>
            ) : (
              <p className="up-next-empty muted">Queuing…</p>
            )}
          </section>

          <div className="player-nook">
            <audio
              ref={audioRef}
              className="audio-hidden"
              preload="metadata"
              tabIndex={-1}
              aria-hidden="true"
              onEnded={onEnded}
              onPlaying={handleAudioPlaying}
              onError={handleAudioError}
            />
            <CozyAudioBar audioRef={audioRef} disabled={!track} />

            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void requestNextTrack()}>
                Next
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                />
                Auto-advance when track ends
              </label>
            </div>
            {status && track ? <p className="hint">{status}</p> : null}
          </div>
        </article>

        <aside className="card history" aria-label="Recently played">
          <h2>History</h2>
          <ol className="history-list">
            {history.map((t, idx) => (
              <li key={`${t.id}-${idx}-${t.title}`}>
                <span className="h-artist">{t.artist}</span>
                <span className="sep">—</span>
                <span className="h-title">{t.title}</span>
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <footer className="footer">
        <small className="muted">Developed by Pablo Murad — 2026</small>
      </footer>
    </div>
  );
}
