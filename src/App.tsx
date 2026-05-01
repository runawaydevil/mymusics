import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

type TrackInfo = {
  id: string;
  title: string;
  artist: string;
};

type RandomResponse = {
  track: TrackInfo;
  streamUrl: string;
};

type ErrBody = { error?: string };

type HealthBody = {
  tracksReady?: boolean;
  hint?: string;
  metadataTsv?: string;
  metadataEnvRequested?: string;
  metadataUsedFallback?: boolean;
  metadataExists?: boolean;
  trackCount?: number;
};

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [status, setStatus] = useState<string>("");
  const [history, setHistory] = useState<TrackInfo[]>([]);
  const [autoPlay, setAutoPlay] = useState(true);
  const [healthWarn, setHealthWarn] = useState<string | null>(null);
  const [healthInfo, setHealthInfo] = useState<string | null>(null);

  const playUrl = useCallback((url: string) => {
    const a = audioRef.current;
    if (!a) return;
    a.src = url;
    a.load();
    void a.play().catch(() => {
      setStatus("Playback was blocked — click play.");
    });
  }, []);

  const loadNext = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/track/random");
      const body = (await res.json()) as RandomResponse | ErrBody;
      if (!res.ok) {
        setTrack(null);
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
    } catch {
      setStatus("Network error while requesting a track.");
    }
  }, [playUrl]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/health");
        const h = (await res.json()) as HealthBody;
        if (!h.tracksReady) {
          setHealthInfo(null);
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
          if (h.metadataUsedFallback && h.metadataEnvRequested && h.metadataTsv) {
            setHealthInfo(
              `METADATA_TSV was not found at ${h.metadataEnvRequested}. Using bundled file at ${h.metadataTsv}. Remove or fix METADATA_TSV in .env / PM2.`,
            );
          } else {
            setHealthInfo(null);
          }
        }
      } catch {
        setHealthWarn(null);
      }
    })();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount bootstrap
    void loadNext();
  }, [loadNext]);

  const onEnded = () => {
    if (autoPlay) void loadNext();
  };

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
      {healthInfo ? (
        <div className="health-info" role="status">
          <strong>Metadata path</strong>
          <p>{healthInfo}</p>
        </div>
      ) : null}
      <header className="header">
        <img
          className="logo"
          src="/mymusics.png"
          alt="MyMusics"
          width={200}
          height={80}
          decoding="async"
        />
      </header>

      <main className="main">
        <section className="card now-playing">
          <h2>Now playing</h2>
          {track ? (
            <div className="track-block">
              <p className="artist">{track.artist}</p>
              <p className="title">{track.title}</p>
            </div>
          ) : (
            <p className="muted">{status || "No track loaded."}</p>
          )}

          <audio
            ref={audioRef}
            className="player"
            controls
            controlsList="nodownload noplaybackrate"
            preload="metadata"
            onEnded={onEnded}
          />

          <div className="actions">
            <button type="button" className="btn primary" onClick={() => void loadNext()}>
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
        </section>

        <section className="card history">
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
        </section>
      </main>

      <footer className="footer">
        <small className="muted">Developed by Pablo Murad — 2026</small>
      </footer>
    </div>
  );
}
