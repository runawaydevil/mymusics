import fs from "node:fs";

/** Internet Archive item containing the Dragon Hoard ZIPs. */
export const IA_DRAGON_HOARD_ID = "myspace_dragon_hoard_2010";

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  /** Basename, e.g. std_xxx.mp3 */
  fileKey: string;
  /** Original MySpace CDN URL from the TSV (last column). */
  cdnUrl: string;
  /** Direct Internet Archive download URL (file inside the collection ZIP). */
  archiveUrl: string;
}

function basenameFromUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const last = u.replace(/\/+$/, "").split("/").pop() ?? "";
  return last.toLowerCase().endsWith(".mp3") ? last : null;
}

/**
 * Build an archive.org download URL for an MP3 inside a collection ZIP, matching
 * the Hobbit / ia-myspace-music-search player logic.
 * @see https://github.com/jbaicoianu/ia-myspace-music-search/blob/master/src/viewer.js
 */
export function buildArchiveDownloadUrl(
  cdnUrl: string,
  itemId: string = IA_DRAGON_HOARD_ID,
): string | null {
  let parsed: URL;
  try {
    parsed = new URL(cdnUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if (pathParts.length < 2) return null;
  const collection = pathParts[0]!;
  const fname = pathParts[pathParts.length - 1]!;
  if (!fname.toLowerCase().endsWith(".mp3")) return null;
  return `https://archive.org/download/${itemId}/${collection}.zip/${encodeURIComponent(`${collection}/${fname}`)}`;
}

/**
 * Read metadata.tsv and return every track that maps to a valid Internet Archive URL.
 * Does not require local MP3 files.
 */
export function loadTracksFromTsv(tsvPath: string, itemId: string = IA_DRAGON_HOARD_ID): TrackMeta[] {
  if (!fs.existsSync(tsvPath)) {
    throw new Error(`METADATA_TSV not found: ${tsvPath}`);
  }

  const out: TrackMeta[] = [];
  const raw = fs.readFileSync(tsvPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length < 4) continue;
    const id = parts[0]!;
    const title = parts[1]!;
    const artist = parts[3]!;
    const cdnUrl = parts[parts.length - 1]!;
    const archiveUrl = buildArchiveDownloadUrl(cdnUrl, itemId);
    if (!archiveUrl) continue;
    const bn = basenameFromUrl(cdnUrl);
    if (!bn) continue;
    out.push({
      id,
      title,
      artist,
      fileKey: bn,
      cdnUrl,
      archiveUrl,
    });
  }
  return out;
}
