export type EmbedTheme = "default" | "compact";

export type EmbedParams = {
  autoplay: boolean;
  theme: EmbedTheme;
  startId: string | null;
  showBrand: boolean;
  startMuted: boolean;
};

function parseBool(raw: string | null, defaultValue: boolean): boolean {
  if (raw === null || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

export function parseEmbedParams(search: string): EmbedParams {
  const p = new URLSearchParams(search);
  const themeRaw = p.get("theme")?.trim().toLowerCase();
  return {
    autoplay: parseBool(p.get("autoplay"), true),
    theme: themeRaw === "compact" ? "compact" : "default",
    startId: p.get("start")?.trim() || null,
    showBrand: parseBool(p.get("brand"), true),
    startMuted: parseBool(p.get("muted"), false),
  };
}

export function buildEmbedSearchParams(opts: Partial<EmbedParams>): string {
  const p = new URLSearchParams();
  if (opts.autoplay === false) p.set("autoplay", "0");
  if (opts.theme === "compact") p.set("theme", "compact");
  if (opts.startId) p.set("start", opts.startId);
  if (opts.showBrand === false) p.set("brand", "0");
  if (opts.startMuted) p.set("muted", "1");
  const s = p.toString();
  return s ? `?${s}` : "";
}
