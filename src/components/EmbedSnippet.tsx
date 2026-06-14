import { useCallback, useMemo, useState } from "react";
import { PUBLIC_SITE_URL } from "../config/siteUrl";
import { buildEmbedSearchParams } from "../lib/embedParams";
import { EMBED_FONT_IDS, EMBED_PRESET_IDS, type EmbedFontId, type EmbedPresetId } from "../lib/embedTheme";

function buildIframeSnippet(opts: {
  autoplay: boolean;
  compact: boolean;
  startId: string;
  showBrand: boolean;
  preset: EmbedPresetId;
  accent: string;
  useAccent: boolean;
  radius: string;
  font: EmbedFontId;
}): string {
  const radiusNum = opts.radius.trim() ? Number.parseInt(opts.radius, 10) : undefined;
  const qs = buildEmbedSearchParams({
    autoplay: opts.autoplay,
    theme: opts.compact ? "compact" : "default",
    startId: opts.startId.trim() || null,
    showBrand: opts.showBrand,
    preset: opts.preset,
    accent: opts.useAccent ? opts.accent : undefined,
    radius: Number.isFinite(radiusNum) ? radiusNum : undefined,
    font: opts.font,
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

type Props = {
  className?: string;
};

export function EmbedSnippet({ className }: Props = {}) {
  const [copied, setCopied] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [compact, setCompact] = useState(false);
  const [showBrand, setShowBrand] = useState(true);
  const [startId, setStartId] = useState("");
  const [preset, setPreset] = useState<EmbedPresetId>("default");
  const [useAccent, setUseAccent] = useState(false);
  const [accent, setAccent] = useState("#e64a19");
  const [radius, setRadius] = useState("");
  const [font, setFont] = useState<EmbedFontId>("sans");

  const embedOptions = useMemo(
    () => ({
      autoplay,
      compact,
      startId,
      showBrand,
      preset,
      accent,
      useAccent,
      radius,
      font,
    }),
    [autoplay, compact, startId, showBrand, preset, accent, useAccent, radius, font],
  );

  const code = useMemo(() => buildIframeSnippet(embedOptions), [embedOptions]);

  const previewSrc = useMemo(() => {
    const radiusNum = radius.trim() ? Number.parseInt(radius, 10) : undefined;
    const qs = buildEmbedSearchParams({
      autoplay: false,
      theme: compact ? "compact" : "default",
      startId: startId.trim() || null,
      showBrand,
      preset,
      accent: useAccent ? accent : undefined,
      radius: Number.isFinite(radiusNum) ? radiusNum : undefined,
      font,
    });
    return `${PUBLIC_SITE_URL}/embed${qs}`;
  }, [compact, startId, showBrand, preset, accent, useAccent, radius, font]);

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
    <section
      className={["embed-snippet", "card", className].filter(Boolean).join(" ")}
      aria-label="Embed this player"
    >
      <h2 className="embed-snippet-title">Embed on your site</h2>
      <p className="embed-snippet-lead muted">
        Paste the HTML below on your page. Customize colors with presets and query params, or update
        the theme at runtime via <code>postMessage</code>. See{" "}
        <code>docs/EMBED-CUSTOMIZATION.md</code> for the full guide.
      </p>

      <div className="embed-snippet-options">
        <label className="check">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          Autoplay / auto-advance
        </label>
        <label className="check">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Compact layout
        </label>
        <label className="check">
          <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} />
          Show MyMusics logo
        </label>

        <div className="embed-snippet-theme-row">
          <label className="embed-snippet-field">
            <span>Preset</span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as EmbedPresetId)}
              aria-label="Color preset"
            >
              {EMBED_PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="embed-snippet-field">
            <span>Font</span>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value as EmbedFontId)}
              aria-label="Font stack"
            >
              {EMBED_FONT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="embed-snippet-field">
            <span>Radius (px)</span>
            <input
              type="number"
              min={0}
              max={24}
              placeholder="default"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              aria-label="Border radius in pixels"
            />
          </label>

          <label className="check embed-snippet-field">
            <span>Custom accent</span>
            <span className="embed-snippet-accent-row">
              <input
                type="checkbox"
                checked={useAccent}
                onChange={(e) => setUseAccent(e.target.checked)}
                aria-label="Use custom accent color"
              />
              <input
                type="color"
                value={accent}
                disabled={!useAccent}
                onChange={(e) => setAccent(e.target.value)}
                aria-label="Accent color"
              />
            </span>
          </label>
        </div>

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

      <div className="embed-snippet-preview-wrap">
        <iframe
          className="embed-snippet-preview"
          src={previewSrc}
          title="MyMusics embed preview"
          loading="lazy"
          allow="autoplay"
        />
      </div>

      <textarea className="embed-snippet-code" readOnly rows={8} value={code} spellCheck={false} />
      <button type="button" className="btn primary embed-snippet-copy" onClick={() => void copy()}>
        {copied ? "Copied!" : "Copy code"}
      </button>
      <p className="embed-snippet-lead muted">
        oEmbed:{" "}
        <code>
          {PUBLIC_SITE_URL}/api/oembed?url=
          {encodeURIComponent(`${PUBLIC_SITE_URL}/embed${buildEmbedSearchParams({ preset, accent: useAccent ? accent : undefined, font })}`)}
        </code>
      </p>
    </section>
  );
}
