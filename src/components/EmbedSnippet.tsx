import { useCallback, useMemo, useState } from "react";
import { PUBLIC_SITE_URL } from "../config/siteUrl";
import { buildEmbedSearchParams } from "../lib/embedParams";

function buildIframeSnippet(opts: {
  autoplay: boolean;
  compact: boolean;
  startId: string;
  showBrand: boolean;
}): string {
  const qs = buildEmbedSearchParams({
    autoplay: opts.autoplay,
    theme: opts.compact ? "compact" : "default",
    startId: opts.startId.trim() || null,
    showBrand: opts.showBrand,
  });
  const src = `${PUBLIC_SITE_URL}/embed${qs}`;
  return `<iframe
  src="${src}"
  title="MyMusics"
  width="100%"
  height="540"
  style="max-width:380px;border:0;border-radius:12px"
  loading="lazy"
  allow="autoplay"
></iframe>`;
}

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [compact, setCompact] = useState(false);
  const [showBrand, setShowBrand] = useState(true);
  const [startId, setStartId] = useState("");

  const code = useMemo(
    () => buildIframeSnippet({ autoplay, compact, startId, showBrand }),
    [autoplay, compact, startId, showBrand],
  );

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(false);
      }
    }
  }, [code]);

  return (
    <section className="embed-snippet card" aria-label="Embed this player">
      <h2 className="embed-snippet-title">Embed on your site</h2>
      <p className="embed-snippet-lead muted">
        Paste this HTML wherever you want the player. Optional query params:{" "}
        <code>autoplay=0</code>, <code>theme=compact</code>, <code>start=TRACK_ID</code>,{" "}
        <code>brand=0</code>, <code>muted=1</code>. Parent page can listen for{" "}
        <code>postMessage</code> events (<code>mymusics:track</code>, <code>mymusics:state</code>, etc.).
      </p>

      <div className="embed-snippet-options">
        <label className="check">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          Autoplay / auto-advance
        </label>
        <label className="check">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Compact theme
        </label>
        <label className="check">
          <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} />
          Show MyMusics logo
        </label>
        <label className="embed-snippet-start">
          <span>Start track id (optional)</span>
          <input
            type="text"
            value={startId}
            onChange={(e) => setStartId(e.target.value)}
            placeholder="e.g. 12345"
            spellCheck={false}
          />
        </label>
      </div>

      <textarea className="embed-snippet-code" readOnly rows={8} value={code} spellCheck={false} />
      <button type="button" className="btn primary embed-snippet-copy" onClick={() => void copy()}>
        {copied ? "Copied!" : "Copy code"}
      </button>
      <p className="embed-snippet-lead muted">
        oEmbed: <code>{PUBLIC_SITE_URL}/api/oembed?url={encodeURIComponent(`${PUBLIC_SITE_URL}/embed`)}</code>
      </p>
    </section>
  );
}
