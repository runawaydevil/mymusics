import { useCallback, useEffect, useState } from "react";

import type { TrackInfo } from "../hooks/useMyMusicsPlayback";

type Result = Pick<TrackInfo, "id" | "title" | "artist">;

type Props = {
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export function TrackSearch({ onSelect, disabled }: Props) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setBusy(true);
        try {
          const res = await fetch(
            `/api/track/search?q=${encodeURIComponent(trimmed)}&limit=15`,
          );
          const body = (await res.json()) as { tracks?: Result[] };
          setResults(body.tracks ?? []);
        } catch {
          setResults([]);
        } finally {
          setBusy(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const pick = useCallback(
    (id: string) => {
      onSelect(id);
      setQ("");
      setResults([]);
    },
    [onSelect],
  );

  return (
    <section className="track-search card" aria-label="Search tracks">
      <h2>Search</h2>
      <input
        type="search"
        className="track-search-input"
        placeholder="Artist or title…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
      {busy ? <p className="muted track-search-hint">Searching…</p> : null}
      {results.length > 0 ? (
        <ul className="track-search-results">
          {results.map((r) => (
            <li key={r.id}>
              <button type="button" className="track-search-hit" onClick={() => pick(r.id)}>
                <span className="h-artist">{r.artist}</span>
                <span className="sep">—</span>
                <span className="h-title">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : q.trim().length >= 2 && !busy ? (
        <p className="muted track-search-hint">No matches.</p>
      ) : null}
    </section>
  );
}
