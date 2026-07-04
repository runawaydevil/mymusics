import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { CozyAudioBar } from "../components/CozyAudioBar";
import { PlayerAttribution } from "../components/PlayerAttribution";
import { PlayerStatus } from "../components/PlayerStatus";
import { PUBLIC_SITE_URL } from "../config/siteUrl";
import { parseEmbedParams } from "../lib/embedParams";
import {
  applyEmbedTheme,
  clearEmbedTheme,
  mergeThemeOverrides,
  type EmbedThemeOverrides,
} from "../lib/embedTheme";
import { useEmbedMessaging } from "../hooks/useEmbedMessaging";
import { useMyMusicsPlayback } from "../hooks/useMyMusicsPlayback";
import "../App.css";

const EMBED_ROOT_CLASS = "embed-active";

export default function Embed() {
  const location = useLocation();
  const params = useMemo(() => parseEmbedParams(location.search), [location.search]);
  const [runtimePatches, setRuntimePatches] = useState<Record<string, EmbedThemeOverrides>>({});

  const themeOverrides = useMemo(
    () => mergeThemeOverrides(params.themeOverrides, runtimePatches[location.search] ?? {}),
    [params.themeOverrides, runtimePatches, location.search],
  );

  useEffect(() => {
    document.documentElement.classList.add(EMBED_ROOT_CLASS);
    return () => {
      document.documentElement.classList.remove(EMBED_ROOT_CLASS);
      clearEmbedTheme();
    };
  }, []);

  useEffect(() => {
    applyEmbedTheme(themeOverrides);
  }, [themeOverrides]);

  const handleThemePatch = useCallback(
    (patch: EmbedThemeOverrides) => {
      setRuntimePatches((prev) => ({
        ...prev,
        [location.search]: mergeThemeOverrides(prev[location.search] ?? {}, patch),
      }));
    },
    [location.search],
  );

  const {
    audioRef,
    audioElARef,
    audioElBRef,
    audioGeneration,
    track,
    streamUrl,
    upNext,
    status,
    playbackPhase,
    embedPlaybackState,
    autoPlay,
    setAutoPlay,
    healthWarn,
    poolTrackCount,
    queueBusy,
    requestNextTrack,
    requestPrevTrack,
    canGoPrev,
    handlePlay,
    handlePause,
    showUpNextHint,
  } = useMyMusicsPlayback({
    startTrackId: params.startId,
    autoplayOnMount: params.autoplay,
    autoAdvance: params.autoplay,
    startMuted: params.startMuted,
  });

  useEmbedMessaging({
    enabled: true,
    trackCount: poolTrackCount,
    track,
    streamUrl,
    playbackState: embedPlaybackState,
    onNext: requestNextTrack,
    onPlay: handlePlay,
    onPause: handlePause,
    onTheme: handleThemePatch,
    themeOverrides,
  });

  const shellClass =
    params.theme === "compact" ? "embed-shell embed-shell--compact" : "embed-shell";

  return (
    <div className="embed-page">
      <div className={shellClass}>
        {healthWarn ? (
          <details className="health-banner health-banner--embed">
            <summary>Server metadata</summary>
            <p>{healthWarn}</p>
          </details>
        ) : null}

        <article className="card now-playing">
          <header className="card-head">
            <h2>Now playing</h2>
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
                  <p className="up-next-note muted">Only one track — repeats.</p>
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
            <PlayerStatus phase={playbackPhase} status={status} hasTrack={!!track} compact />

            <div className="actions">
              <div className="transport" role="group" aria-label="Transport controls">
                <button
                  type="button"
                  className="btn btn-icon"
                  onClick={() => void requestPrevTrack()}
                  disabled={!canGoPrev}
                  aria-label="Previous track"
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
                >
                  <span>Next</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="btn-glyph">
                    <path d="M17 6v12h2V6h-2zM5 6v12l9-6-9-6z" fill="currentColor" />
                  </svg>
                </button>
              </div>
              {params.autoplay ? (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={autoPlay}
                    onChange={(e) => setAutoPlay(e.target.checked)}
                  />
                  Auto-advance
                </label>
              ) : null}
            </div>
          </div>
          <PlayerAttribution compact />
        </article>

        {params.showBrand ? (
          <div className="embed-brand">
            <a
              className="embed-brand-link"
              href={PUBLIC_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="MyMusics"
            >
              <img
                className="embed-brand-logo"
                src="/mymusics.png"
                alt="MyMusics"
                width={200}
                height={80}
                decoding="async"
              />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
