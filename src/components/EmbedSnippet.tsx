import { useCallback, useState } from "react";
import { PUBLIC_SITE_URL } from "../config/siteUrl";

function buildIframeSnippet(): string {
  const src = `${PUBLIC_SITE_URL}/embed`;
  return `<iframe
  src="${src}"
  title="MyMusics"
  width="100%"
  height="420"
  style="max-width:420px;border:0;border-radius:12px"
  loading="lazy"
></iframe>`;
}

export function EmbedSnippet() {
  const [copied, setCopied] = useState(false);
  const code = buildIframeSnippet();

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
      <p className="embed-snippet-lead muted">Paste this HTML wherever you want the player to appear.</p>
      <textarea className="embed-snippet-code" readOnly rows={7} value={code} spellCheck={false} />
      <button type="button" className="btn primary embed-snippet-copy" onClick={() => void copy()}>
        {copied ? "Copied!" : "Copy code"}
      </button>
    </section>
  );
}
