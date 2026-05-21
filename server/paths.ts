import fs from "node:fs";
import path from "node:path";

export function getProjectRoot(): string {
  return process.cwd();
}

export function resolvePath(p: string, root = getProjectRoot()): string {
  return path.isAbsolute(p) ? p : path.resolve(root, p);
}

export function bundledMetadataTsv(root = getProjectRoot()): string {
  return path.join(root, "data", "metadata.tsv");
}

export function bundledTracksDb(root = getProjectRoot()): string {
  return path.join(root, "data", "tracks.db");
}

export function resolveEffectiveMetadataTsv(
  env: NodeJS.ProcessEnv,
  root = getProjectRoot(),
): { path: string; envRequested: string | null; usedFallback: boolean } {
  const bundled = bundledMetadataTsv(root);
  const raw = env.METADATA_TSV?.trim();
  if (!raw) {
    return { path: bundled, envRequested: null, usedFallback: false };
  }
  const resolved = resolvePath(raw, root);
  if (fs.existsSync(resolved)) {
    return { path: resolved, envRequested: resolved, usedFallback: false };
  }
  if (fs.existsSync(bundled)) {
    console.warn(`MyMusics: METADATA_TSV not found at ${resolved}; using bundled ${bundled}`);
    return { path: bundled, envRequested: resolved, usedFallback: true };
  }
  return { path: resolved, envRequested: resolved, usedFallback: false };
}

export function resolveTracksDb(env: NodeJS.ProcessEnv, root = getProjectRoot()): string {
  const raw = env.TRACKS_DB?.trim();
  return raw ? resolvePath(raw, root) : bundledTracksDb(root);
}
