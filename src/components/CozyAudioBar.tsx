import { type ChangeEvent, type RefObject, useCallback, useEffect, useState } from "react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type Props = {
  audioRef: RefObject<HTMLAudioElement | null>;
  /** No track / no usable stream */
  disabled?: boolean;
};

export function CozyAudioBar({ audioRef, disabled }: Props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const syncFromElement = () => {
      setCurrentTime(el.currentTime);
      const d = el.duration;
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
      setPlaying(!el.paused);
      setMuted(el.muted);
    };

    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onLoadedMeta = () => syncFromElement();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVol = () => setMuted(el.muted);

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadedmetadata", onLoadedMeta);
    el.addEventListener("durationchange", onLoadedMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("volumechange", onVol);

    syncFromElement();

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadedmetadata", onLoadedMeta);
      el.removeEventListener("durationchange", onLoadedMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("volumechange", onVol);
    };
  }, [audioRef]);

  const pct =
    duration > 0 && Number.isFinite(duration) ? Math.min(100, (currentTime / duration) * 100) : 0;

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el || disabled) return;
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }, [audioRef, disabled]);

  const onSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const el = audioRef.current;
      if (!el || disabled || duration <= 0) return;
      const next = (parseFloat(e.target.value) / 100) * duration;
      el.currentTime = next;
      setCurrentTime(next);
    },
    [audioRef, disabled, duration],
  );

  const toggleMute = useCallback(() => {
    const el = audioRef.current;
    if (!el || disabled) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  }, [audioRef, disabled]);

  const durLabel = formatTime(duration);
  const curLabel = formatTime(currentTime);

  return (
    <div
      className={`cozy-player${disabled ? " cozy-player--disabled" : ""}`}
      role="group"
      aria-label="Audio playback"
    >
      <button
        type="button"
        className="cozy-player__play"
        onClick={() => void togglePlay()}
        disabled={disabled}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg className="cozy-player__icon" viewBox="0 0 24 24" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
            <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg className="cozy-player__icon" viewBox="0 0 24 24" aria-hidden>
            <path d="M9 6.5v11l9-5.5z" fill="currentColor" />
          </svg>
        )}
      </button>

      <div className="cozy-player__progress-wrap">
        <span className="cozy-player__time cozy-player__time--current">{curLabel}</span>
        <input
          type="range"
          className="cozy-player__scrub"
          min={0}
          max={100}
          step={0.25}
          value={pct}
          onChange={onSeek}
          disabled={disabled || duration <= 0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${curLabel} of ${durLabel}`}
        />
        <span className="cozy-player__time cozy-player__time--duration">{durLabel}</span>
      </div>

      <button
        type="button"
        className="cozy-player__mute"
        onClick={() => void toggleMute()}
        disabled={disabled}
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
      >
        {muted ? (
          <svg className="cozy-player__icon" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"
            />
          </svg>
        ) : (
          <svg className="cozy-player__icon" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
