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
    audioElARef,
    audioElBRef,
    audioGeneration,
    track,
    status,
    playbackPhase,
    upNext,
    history,
    historyCursor,
    autoPlay,
    setAutoPlay,
    healthWarn,
    queueBusy,
    requestNextTrack,
    requestPrevTrack,
    canGoPrev,
    loadTrackById,
    showUpNextHint,
  } = useMyMusicsPlayback({
    startTrackId,
    autoplayOnMount: true,
  });

  usePlayerKeyboard({
    audioRef,
    enabled: true,
    onNext: requestNextTrack,
    onPrev: requestPrevTrack,
  });

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
            {history.length === 0 ? (
              <p className="history-empty muted">Nothing played yet.</p>
            ) : (
              <ol className="history-list">
                {history.map((t, idx) => {
                  const isCurrent = idx === historyCursor;
                  return (
                    <li
                      key={`${t.id}-${idx}-${t.title}`}
                      className={isCurrent ? "history-item history-item--current" : "history-item"}
                    >
                      <button
                        type="button"
                        className="history-hit"
                        onClick={() => void loadTrackById(t.id)}
                        aria-current={isCurrent ? "true" : undefined}
                      >
                        <span className="history-eq" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="history-text">
                          <span className="h-artist">{t.artist}</span>
                          <span className="sep">—</span>
                          <span className="h-title">{t.title}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
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
            <div className="track-block" role="status" aria-live="polite" aria-atomic="true">
              <p className="artist">
                <span
                  className={`np-eq${playbackPhase === "playing" ? " np-eq--on" : ""}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                {track.artist}
              </p>
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
              ref={audioElARef}
              className="audio-hidden"
              preload="auto"
              tabIndex={-1}
              aria-hidden="true"
            />
            <audio
              ref={audioElBRef}
              className="audio-hidden"
              preload="auto"
              tabIndex={-1}
              aria-hidden="true"
            />
            <CozyAudioBar audioRef={audioRef} generation={audioGeneration} disabled={!track} />
            <PlayerStatus phase={playbackPhase} status={status} hasTrack={!!track} />

            <div className="actions">
              <div className="transport" role="group" aria-label="Transport controls">
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => void requestPrevTrack()}
                  disabled={!canGoPrev}
                  aria-label="Previous track"
                  title="Previous (P)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-glyph">
                    <path d="M7 6v12H5V6h2zm12 0v12l-9-6 9-6z" fill="currentColor" />
                  </svg>
                  <span>Prev</span>
                </button>
                <button
                  type="button"
                  className="btn primary btn-icon"
                  onClick={() => void requestNextTrack()}
                  aria-label="Next track"
                  title="Next (N)"
                >
                  <span>Next</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-glyph">
                    <path d="M17 6v12h2V6h-2zM5 6v12l9-6-9-6z" fill="currentColor" />
                  </svg>
                </button>
              </div>
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
              Shortcuts: Space play/pause, P previous, N next, M mute
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
