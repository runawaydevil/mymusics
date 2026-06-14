export type EmbedPresetId = "default" | "light" | "dark" | "midnight" | "minimal";

export type EmbedFontId = "system" | "sans" | "serif";

export type EmbedThemeOverrides = {
  preset?: EmbedPresetId;
  accent?: string | null;
  bg?: string | null;
  panel?: string | null;
  text?: string | null;
  fgMuted?: string | null;
  radius?: number | null;
  font?: EmbedFontId | null;
};

export type EmbedThemeTokens = {
  bg: string;
  bgPanel: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSecondary: string;
  border: string;
  radius: string;
  shadow: string;
  fontBody: string;
  fontDisplay: string;
};

export const EMBED_PRESET_IDS: EmbedPresetId[] = [
  "default",
  "light",
  "dark",
  "midnight",
  "minimal",
];

export const EMBED_FONT_IDS: EmbedFontId[] = ["system", "sans", "serif"];

const FONT_STACKS: Record<EmbedFontId, { body: string; display: string }> = {
  system: {
    body: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sans: {
    body: '"Source Sans 3", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    display: '"Source Sans 3", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  serif: {
    body: '"Source Sans 3", system-ui, sans-serif',
    display: '"Fraunces", Georgia, "Times New Roman", serif',
  },
};

const PRESETS: Record<EmbedPresetId, EmbedThemeTokens> = {
  default: {
    bg: "#000f28",
    bgPanel: "#0a1f3d",
    text: "#f2f7ff",
    textMuted: "rgba(242, 247, 255, 0.74)",
    accent: "#fbc02d",
    accentSecondary: "#40c4ff",
    border: "rgba(64, 196, 255, 0.38)",
    radius: "14px",
    shadow: "0 14px 42px rgba(0, 10, 30, 0.45)",
    fontBody: FONT_STACKS.sans.body,
    fontDisplay: FONT_STACKS.serif.display,
  },
  light: {
    bg: "#f1f5f9",
    bgPanel: "#ffffff",
    text: "#0f172a",
    textMuted: "#64748b",
    accent: "#e64a19",
    accentSecondary: "#3498db",
    border: "rgba(52, 152, 219, 0.35)",
    radius: "12px",
    shadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
    fontBody: FONT_STACKS.sans.body,
    fontDisplay: FONT_STACKS.serif.display,
  },
  dark: {
    bg: "#121212",
    bgPanel: "#1e1e1e",
    text: "#f5f5f5",
    textMuted: "rgba(245, 245, 245, 0.68)",
    accent: "#fbc02d",
    accentSecondary: "#90caf9",
    border: "rgba(255, 255, 255, 0.14)",
    radius: "12px",
    shadow: "0 10px 32px rgba(0, 0, 0, 0.55)",
    fontBody: FONT_STACKS.sans.body,
    fontDisplay: FONT_STACKS.sans.display,
  },
  midnight: {
    bg: "#000f28",
    bgPanel: "#001b44",
    text: "#f2f7ff",
    textMuted: "rgba(242, 247, 255, 0.72)",
    accent: "#40c4ff",
    accentSecondary: "#3498db",
    border: "rgba(64, 196, 255, 0.42)",
    radius: "14px",
    shadow: "0 16px 48px rgba(0, 8, 24, 0.6)",
    fontBody: FONT_STACKS.sans.body,
    fontDisplay: FONT_STACKS.serif.display,
  },
  minimal: {
    bg: "#0b1220",
    bgPanel: "#111827",
    text: "#e5e7eb",
    textMuted: "#9ca3af",
    accent: "#fbbf24",
    accentSecondary: "#93c5fd",
    border: "rgba(156, 163, 175, 0.28)",
    radius: "8px",
    shadow: "none",
    fontBody: FONT_STACKS.system.body,
    fontDisplay: FONT_STACKS.system.display,
  },
};

export const MM_CSS_VAR_KEYS = [
  "--mm-bg",
  "--mm-bg-panel",
  "--mm-text",
  "--mm-text-muted",
  "--mm-accent",
  "--mm-accent-secondary",
  "--mm-border",
  "--mm-radius",
  "--mm-shadow",
  "--mm-font-body",
  "--mm-font-display",
] as const;

const HEX3 = /^[0-9a-fA-F]{3}$/;
const HEX6 = /^[0-9a-fA-F]{6}$/;

/** Parse hex color from URL or postMessage (with/without #, optional URI encoding). */
export function parseHexColor(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.trim();
  if (!s) return null;
  try {
    s = decodeURIComponent(s);
  } catch {
    return null;
  }
  if (s.startsWith("#")) s = s.slice(1);
  if (HEX3.test(s)) {
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!HEX6.test(s)) return null;
  return `#${s.toUpperCase()}`;
}

export function parseEmbedRadius(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(24, Math.max(0, n));
}

export function parseEmbedPreset(raw: string | null | undefined): EmbedPresetId | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase() as EmbedPresetId;
  return EMBED_PRESET_IDS.includes(id) ? id : null;
}

export function parseEmbedFont(raw: string | null | undefined): EmbedFontId | null {
  if (!raw) return null;
  const id = raw.trim().toLowerCase() as EmbedFontId;
  return EMBED_FONT_IDS.includes(id) ? id : null;
}

export function resolveEmbedTheme(overrides: EmbedThemeOverrides = {}): EmbedThemeTokens {
  const presetId = overrides.preset ?? "default";
  const base = PRESETS[presetId] ?? PRESETS.default;
  const fontId = overrides.font ?? null;
  const fontStack = fontId ? FONT_STACKS[fontId] : null;

  return {
    bg: parseHexColor(overrides.bg) ?? base.bg,
    bgPanel: parseHexColor(overrides.panel) ?? base.bgPanel,
    text: parseHexColor(overrides.text) ?? base.text,
    textMuted: parseHexColor(overrides.fgMuted) ?? base.textMuted,
    accent: parseHexColor(overrides.accent) ?? base.accent,
    accentSecondary: base.accentSecondary,
    border: base.border,
    radius:
      overrides.radius !== null && overrides.radius !== undefined
        ? `${overrides.radius}px`
        : base.radius,
    shadow: base.shadow,
    fontBody: fontStack?.body ?? base.fontBody,
    fontDisplay: fontStack?.display ?? base.fontDisplay,
  };
}

export function tokensToCssVars(tokens: EmbedThemeTokens): Record<string, string> {
  return {
    "--mm-bg": tokens.bg,
    "--mm-bg-panel": tokens.bgPanel,
    "--mm-text": tokens.text,
    "--mm-text-muted": tokens.textMuted,
    "--mm-accent": tokens.accent,
    "--mm-accent-secondary": tokens.accentSecondary,
    "--mm-border": tokens.border,
    "--mm-radius": tokens.radius,
    "--mm-shadow": tokens.shadow,
    "--mm-font-body": tokens.fontBody,
    "--mm-font-display": tokens.fontDisplay,
  };
}

export function applyEmbedTheme(overrides: EmbedThemeOverrides = {}): EmbedThemeTokens {
  const tokens = resolveEmbedTheme(overrides);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokensToCssVars(tokens))) {
    root.style.setProperty(key, value);
  }
  return tokens;
}

export function clearEmbedTheme(): void {
  const root = document.documentElement;
  for (const key of MM_CSS_VAR_KEYS) {
    root.style.removeProperty(key);
  }
}

export function parseThemePayload(raw: unknown): EmbedThemeOverrides | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const overrides: EmbedThemeOverrides = {};

  if (typeof o.preset === "string") {
    const preset = parseEmbedPreset(o.preset);
    if (preset) overrides.preset = preset;
  }
  if (typeof o.font === "string") {
    const font = parseEmbedFont(o.font);
    if (font) overrides.font = font;
  }

  const radiusRaw = o.radius;
  if (typeof radiusRaw === "number" && Number.isFinite(radiusRaw)) {
    overrides.radius = Math.min(24, Math.max(0, Math.round(radiusRaw)));
  } else if (typeof radiusRaw === "string") {
    const radius = parseEmbedRadius(radiusRaw);
    if (radius !== null) overrides.radius = radius;
  }

  if (typeof o.accent === "string") {
    const accent = parseHexColor(o.accent);
    if (accent) overrides.accent = accent;
  }
  if (typeof o.bg === "string") {
    const bg = parseHexColor(o.bg);
    if (bg) overrides.bg = bg;
  }
  if (typeof o.panel === "string") {
    const panel = parseHexColor(o.panel);
    if (panel) overrides.panel = panel;
  }
  if (typeof o.text === "string") {
    const text = parseHexColor(o.text);
    if (text) overrides.text = text;
  }
  const fgRaw =
    typeof o.fgMuted === "string"
      ? o.fgMuted
      : typeof o.textMuted === "string"
        ? o.textMuted
        : null;
  if (fgRaw) {
    const fgMuted = parseHexColor(fgRaw);
    if (fgMuted) overrides.fgMuted = fgMuted;
  }

  return Object.keys(overrides).length > 0 ? overrides : null;
}

export function mergeThemeOverrides(
  base: EmbedThemeOverrides,
  patch: EmbedThemeOverrides,
): EmbedThemeOverrides {
  return { ...base, ...patch };
}

/** Strip # for URL query params (SoundCloud-style). */
export function hexForQueryParam(hex: string | null | undefined): string | null {
  const parsed = parseHexColor(hex);
  return parsed ? parsed.slice(1).toLowerCase() : null;
}
