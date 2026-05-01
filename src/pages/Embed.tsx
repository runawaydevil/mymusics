import { CozyAudioBar } from "../components/CozyAudioBar";
import { useMyMusicsPlayback } from "../hooks/useMyMusicsPlayback";
import "../App.css";

export default function Embed() {
  const {
    audioRef,
    track,
    upNext,
    status,
    autoPlay,
    setAutoPlay,
    healthWarn,
    queueBusy,
    requestNextTrack,
    handleAudioPlaying,
    handleAudioError,
    onEnded,
    showUpNextHint,
  } = useMyMusicsPlayback();

  return (
    <div className="embed-page">
      <div className="embed-shell">
        {healthWarn ? (
          <div className="health-banner health-banner--embed" role="alert">
            <strong>Server metadata</strong>
            <p>{healthWarn}</p>
          </div>
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
      </div>
    </div>
  );
}
