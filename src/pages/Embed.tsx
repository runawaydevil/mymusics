import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { CozyAudioBar } from "../components/CozyAudioBar";
import { PlayerAttribution } from "../components/PlayerAttribution";
import { PlayerStatus } from "../components/PlayerStatus";
import { PUBLIC_SITE_URL } from "../config/siteUrl";
import { parseEmbedParams } from "../lib/embedParams";
import { useEmbedMessaging } from "../hooks/useEmbedMessaging";
import { useMyMusicsPlayback } from "../hooks/useMyMusicsPlayback";
import "../App.css";

const EMBED_ROOT_CLASS = "embed-active";

export default function Embed() {
  const location = useLocation();
  const params = useMemo(() => parseEmbedParams(location.search), [location.search]);

  useEffect(() => {
    document.documentElement.classList.add(EMBED_ROOT_CLASS);
    return () => {
      document.documentElement.classList.remove(EMBED_ROOT_CLASS);
    };
  }, []);

  const {
    audioRef,
    preloadAudioRef,
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
    handleAudioPlaying,
    handleAudioError,
    handleAudioPause,
    handlePlay,
    handlePause,
    onEnded,
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
            <PlayerStatus phase={playbackPhase} status={status} hasTrack={!!track} compact />

            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void requestNextTrack()}>
                Next
              </button>
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
