import { describe, expect, it } from "vitest";
import { buildEmbedSearchParams, parseEmbedParams } from "./embedParams";
import {
  mergeThemeOverrides,
  parseEmbedFont,
  parseEmbedPreset,
  parseEmbedRadius,
  parseHexColor,
  parseThemePayload,
  resolveEmbedTheme,
} from "./embedTheme";

describe("parseHexColor", () => {
  it("accepts 6-digit hex with or without hash", () => {
    expect(parseHexColor("fbc02d")).toBe("#FBC02D");
    expect(parseHexColor("#fbc02d")).toBe("#FBC02D");
    expect(parseHexColor("%23fbc02d")).toBe("#FBC02D");
  });

  it("expands 3-digit shorthand", () => {
    expect(parseHexColor("f00")).toBe("#FF0000");
    expect(parseHexColor("#abc")).toBe("#AABBCC");
  });

  it("rejects invalid values", () => {
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("gggggg")).toBeNull();
    expect(parseHexColor("12345")).toBeNull();
    expect(parseHexColor("not-a-color")).toBeNull();
  });
});

describe("parseEmbedRadius", () => {
  it("clamps radius between 0 and 24", () => {
    expect(parseEmbedRadius("12")).toBe(12);
    expect(parseEmbedRadius("0")).toBe(0);
    expect(parseEmbedRadius("24")).toBe(24);
    expect(parseEmbedRadius("99")).toBe(24);
    expect(parseEmbedRadius("-5")).toBe(0);
  });

  it("returns null for empty or invalid", () => {
    expect(parseEmbedRadius("")).toBeNull();
    expect(parseEmbedRadius("abc")).toBeNull();
  });
});

describe("resolveEmbedTheme", () => {
  it("merges preset with overrides", () => {
    const tokens = resolveEmbedTheme({ preset: "light", accent: "#112233" });
    expect(tokens.bg).toBe("#f1f5f9");
    expect(tokens.accent).toBe("#112233");
  });

  it("applies custom radius in px", () => {
    const tokens = resolveEmbedTheme({ preset: "minimal", radius: 16 });
    expect(tokens.radius).toBe("16px");
  });
});

describe("parseThemePayload", () => {
  it("parses postMessage theme object", () => {
    expect(parseThemePayload({ preset: "dark", accent: "e64a19" })).toEqual({
      preset: "dark",
      accent: "#E64A19",
    });
  });

  it("returns null when no valid keys", () => {
    expect(parseThemePayload({})).toBeNull();
    expect(parseThemePayload(null)).toBeNull();
    expect(parseThemePayload({ preset: "invalid" })).toBeNull();
  });

  it("accepts fgMuted alias textMuted", () => {
    expect(parseThemePayload({ fgMuted: "94a3b8" })?.fgMuted).toBe("#94A3B8");
    expect(parseThemePayload({ textMuted: "64748b" })?.fgMuted).toBe("#64748B");
  });
});

describe("mergeThemeOverrides", () => {
  it("patch wins over base", () => {
    expect(
      mergeThemeOverrides({ preset: "light", accent: "#111111" }, { accent: "#222222" }),
    ).toEqual({ preset: "light", accent: "#222222" });
  });
});

describe("parseEmbedPreset and parseEmbedFont", () => {
  it("accepts known preset ids", () => {
    expect(parseEmbedPreset("midnight")).toBe("midnight");
    expect(parseEmbedPreset("unknown")).toBeNull();
  });

  it("accepts known font ids", () => {
    expect(parseEmbedFont("serif")).toBe("serif");
    expect(parseEmbedFont("comic")).toBeNull();
  });
});

describe("buildEmbedSearchParams round-trip", () => {
  it("preserves theme params in parseEmbedParams", () => {
    const qs = buildEmbedSearchParams({
      preset: "minimal",
      accent: "#e64a19",
      bg: "0f172a",
      panel: "1e293b",
      text: "f8fafc",
      fgMuted: "94a3b8",
      radius: 10,
      font: "serif",
      theme: "compact",
      showBrand: false,
      startMuted: true,
    });
    const parsed = parseEmbedParams(qs);
    expect(parsed.theme).toBe("compact");
    expect(parsed.showBrand).toBe(false);
    expect(parsed.startMuted).toBe(true);
    expect(parsed.themeOverrides).toMatchObject({
      preset: "minimal",
      accent: "#E64A19",
      bg: "#0F172A",
      panel: "#1E293B",
      text: "#F8FAFC",
      fgMuted: "#94A3B8",
      radius: 10,
      font: "serif",
    });
  });
});
