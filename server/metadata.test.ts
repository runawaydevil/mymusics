import { describe, expect, it } from "vitest";

import { buildArchiveDownloadUrl, parseTrackLine } from "./metadata.js";

describe("buildArchiveDownloadUrl", () => {
  it("builds ZIP member URL from MySpace CDN path", () => {
    const url =
      "http://cache06-music02.myspacecdn.com/46/std_1f69563352d19cb0132334cd0d3adeaf.mp3";
    const out = buildArchiveDownloadUrl(url);
    expect(out).toBe(
      "https://archive.org/download/myspace_dragon_hoard_2010/46.zip/46%2Fstd_1f69563352d19cb0132334cd0d3adeaf.mp3",
    );
  });

  it("returns null for invalid URLs", () => {
    expect(buildArchiveDownloadUrl("not-a-url")).toBeNull();
    expect(buildArchiveDownloadUrl("https://example.com/foo.txt")).toBeNull();
  });
});

describe("parseTrackLine", () => {
  it("parses a valid TSV line", () => {
    const line =
      "1\tBig Yellow Moon\t78393366\tbill nelson\twww.myspace.com/x\t0\tmyspace\t25796\thttp://cache06-music02.myspacecdn.com/46/std_1f69563352d19cb0132334cd0d3adeaf.mp3";
    const t = parseTrackLine(line);
    expect(t).not.toBeNull();
    expect(t!.id).toBe("1");
    expect(t!.title).toBe("Big Yellow Moon");
    expect(t!.artist).toBe("bill nelson");
    expect(t!.fileKey).toMatch(/\.mp3$/i);
  });
});
