import type { PlaybackPhase } from "../hooks/useMyMusicsPlayback";

type Props = {
  phase: PlaybackPhase;
  status: string;
  hasTrack: boolean;
  compact?: boolean;
};

export function PlayerStatus({ phase, status, hasTrack, compact }: Props) {
  if (phase === "loading" || phase === "buffering") {
    return (
      <p className={`player-phase${compact ? " player-phase--compact" : ""}`} role="status">
        {phase === "loading" ? "Loading track…" : "Buffering from Internet Archive…"}
      </p>
    );
  }
  if (status && hasTrack) {
    return (
      <p className={`hint${compact ? " hint--compact" : ""}`} role="status">
        {status}
      </p>
    );
  }
  if (!hasTrack && status) {
    return <p className="muted">{status}</p>;
  }
  return null;
}
