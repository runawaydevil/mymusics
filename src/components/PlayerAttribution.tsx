export function PlayerAttribution({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`player-attribution${compact ? " player-attribution--compact" : ""}`}>
      Audio from{" "}
      <a
        href="https://archive.org/details/myspace_dragon_hoard_2010"
        target="_blank"
        rel="noopener noreferrer"
      >
        Internet Archive — The Myspace Dragon Hoard
      </a>
      .
    </p>
  );
}
