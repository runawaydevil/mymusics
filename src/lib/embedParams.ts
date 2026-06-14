import {
  type EmbedFontId,
  type EmbedPresetId,
  type EmbedThemeOverrides,
  hexForQueryParam,
  parseEmbedFont,
  parseEmbedPreset,
  parseEmbedRadius,
  parseHexColor,
} from "./embedTheme";

export type EmbedTheme = "default" | "compact";

export type EmbedParams = {
  autoplay: boolean;
  theme: EmbedTheme;
  startId: string | null;
  showBrand: boolean;
  startMuted: boolean;
  themeOverrides: EmbedThemeOverrides;
};

function parseBool(raw: string | null, defaultValue: boolean): boolean {
  if (raw === null || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

function parseThemeOverrides(p: URLSearchParams): EmbedThemeOverrides {
  const preset = parseEmbedPreset(p.get("preset"));
  const font = parseEmbedFont(p.get("font"));
  const radius = parseEmbedRadius(p.get("radius"));
  const accent = parseHexColor(p.get("accent"));
  const bg = parseHexColor(p.get("bg"));
  const panel = parseHexColor(p.get("panel"));
  const text = parseHexColor(p.get("text"));
  const fgMuted = parseHexColor(p.get("fgMuted") ?? p.get("textMuted"));

  const overrides: EmbedThemeOverrides = {};
  if (preset) overrides.preset = preset;
  if (font) overrides.font = font;
  if (radius !== null) overrides.radius = radius;
  if (accent) overrides.accent = accent;
  if (bg) overrides.bg = bg;
  if (panel) overrides.panel = panel;
  if (text) overrides.text = text;
  if (fgMuted) overrides.fgMuted = fgMuted;
  return overrides;
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
    themeOverrides: parseThemeOverrides(p),
  };
}

export function buildEmbedSearchParams(
  opts: Partial<
    EmbedParams & {
      themeOverrides?: EmbedThemeOverrides;
      preset?: EmbedPresetId;
      accent?: string;
      bg?: string;
      panel?: string;
      text?: string;
      fgMuted?: string;
      radius?: number;
      font?: EmbedFontId;
    }
  >,
): string {
  const p = new URLSearchParams();
  if (opts.autoplay === false) p.set("autoplay", "0");
  if (opts.theme === "compact") p.set("theme", "compact");
  if (opts.startId) p.set("start", opts.startId);
  if (opts.showBrand === false) p.set("brand", "0");
  if (opts.startMuted) p.set("muted", "1");

  const theme = { ...opts.themeOverrides };
  if (opts.preset) theme.preset = opts.preset;
  if (opts.accent) theme.accent = opts.accent;
  if (opts.bg) theme.bg = opts.bg;
  if (opts.panel) theme.panel = opts.panel;
  if (opts.text) theme.text = opts.text;
  if (opts.fgMuted) theme.fgMuted = opts.fgMuted;
  if (opts.radius !== undefined && opts.radius !== null) theme.radius = opts.radius;
  if (opts.font) theme.font = opts.font;

  if (theme.preset && theme.preset !== "default") p.set("preset", theme.preset);
  const accentQ = hexForQueryParam(theme.accent ?? null);
  if (accentQ) p.set("accent", accentQ);
  const bgQ = hexForQueryParam(theme.bg ?? null);
  if (bgQ) p.set("bg", bgQ);
  const panelQ = hexForQueryParam(theme.panel ?? null);
  if (panelQ) p.set("panel", panelQ);
  const textQ = hexForQueryParam(theme.text ?? null);
  if (textQ) p.set("text", textQ);
  const fgMutedQ = hexForQueryParam(theme.fgMuted ?? null);
  if (fgMutedQ) p.set("fgMuted", fgMutedQ);
  if (theme.radius !== undefined && theme.radius !== null) p.set("radius", String(theme.radius));
  if (theme.font && theme.font !== "sans") p.set("font", theme.font);

  const s = p.toString();
  return s ? `?${s}` : "";
}
