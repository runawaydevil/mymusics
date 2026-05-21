import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { CozyAudioBar } from "../components/CozyAudioBar";
import { EmbedSnippet } from "../components/EmbedSnippet";
import { PlayerAttribution } from "../components/PlayerAttribution";
import { PlayerStatus } from "../components/PlayerStatus";
import { SiteHeader } from "../components/SiteHeader";
import { TrackSearch } from "../components/TrackSearch";
import { PUBLIC_SITE_URL } from "../config/siteUrl";
import { useMyMusicsPlayback } from "../hooks/useMyMusicsPlayback";
import { usePlayerKeyboard } from "../hooks/usePlayerKeyboard";
import "../App.css";

export default function Home() {
  const [searchParams] = useSearchParams();
  const startTrackId = searchParams.get("track")?.trim() || null;
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    audioRef,
    preloadAudioRef,
    track,
    status,
    playbackPhase,
    upNext,
    history,
    autoPlay,
    setAutoPlay,
    healthWarn,
    queueBusy,
    requestNextTrack,
    loadTrackById,
    handleAudioPlaying,
    handleAudioError,
    handleAudioPause,
    onEnded,
    showUpNextHint,
  } = useMyMusicsPlayback({
    startTrackId,
    autoplayOnMount: true,
  });

  usePlayerKeyboard({ audioRef, enabled: true, onNext: requestNextTrack });

  const copyShareLink = useCallback(async () => {
    if (!track) return;
    const url = `${PUBLIC_SITE_URL}/?track=${encodeURIComponent(track.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setLinkCopied(false);
    }
  }, [track]);

  return (
    <div className="page">
      {healthWarn ? (
        <div className="health-banner" role="alert">
          <strong>Server metadata</strong>
          <p>{healthWarn}</p>
          <p className="health-banner-hint">
            On the host, run <code>curl -sS http://127.0.0.1:38471/api/health</code> (adjust
            port) and fix <code>METADATA_TSV</code> or run <code>npm run index-metadata</code>.
          </p>
        </div>
      ) : null}
      <SiteHeader nav="home" />

      <main className="main main-home">
        <div className="main-sidebar">
          <TrackSearch onSelect={(id) => void loadTrackById(id)} disabled={!!healthWarn} />

          <aside className="card history" aria-label="Recently played">
            <h2>History</h2>
            <ol className="history-list">
              {history.map((t, idx) => (
                <li key={`${t.id}-${idx}-${t.title}`}>
                  <button
                    type="button"
                    className="history-hit"
                    onClick={() => void loadTrackById(t.id)}
                  >
                    <span className="h-artist">{t.artist}</span>
                    <span className="sep">—</span>
                    <span className="h-title">{t.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <article className="card now-playing">
          <header className="card-head">
            <h2>Now playing</h2>
            {track ? (
              <button type="button" className="btn btn-share" onClick={() => void copyShareLink()}>
                {linkCopied ? "Link copied!" : "Copy link"}
              </button>
            ) : null}
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
              onPause={handleAudioPause}
              onError={handleAudioError}
            />
            <audio ref={preloadAudioRef} className="audio-hidden" preload="auto" aria-hidden="true" />
            <CozyAudioBar audioRef={audioRef} disabled={!track} />
            <PlayerStatus phase={playbackPhase} status={status} hasTrack={!!track} />

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
            <p className="player-keys-hint muted">
              Shortcuts: Space play/pause, N next, M mute
            </p>
          </div>
          <PlayerAttribution />
        </article>

        <EmbedSnippet className="main-embed" />
      </main>

      <footer className="footer">
        <small className="muted">Developed by Pablo Murad — 2026</small>
      </footer>
    </div>
  );
}
