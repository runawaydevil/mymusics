import path from "node:path";

import dotenv from "dotenv";

import { resolveTracksDb } from "../server/paths.js";
import { TrackStore } from "../server/trackStore.js";

const PROJECT_ROOT = process.cwd();
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const SAMPLE_SIZE = Math.min(
  500,
  Math.max(1, Number(process.env.VERIFY_SAMPLE_SIZE ?? "50")),
);
const TIMEOUT_MS = 15_000;

async function headOk(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      redirect: "follow",
    });
    return res.ok || res.status === 206;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const dbPath = resolveTracksDb(process.env, PROJECT_ROOT);
  const store = new TrackStore(dbPath);
  if (!store.exists()) {
    console.error(`tracks.db not found: ${dbPath}`);
    process.exit(1);
  }
  store.open();

  const picks = store.sampleArchiveUrls(SAMPLE_SIZE);

  let blocked = 0;
  for (const row of picks) {
    const ok = await headOk(row.archiveUrl);
    if (!ok) {
      store.blockId(row.id);
      blocked += 1;
      console.warn(`Blocked ${row.id} — HEAD failed`);
    }
  }

  store.close();
  console.info(`verify-tracks: checked ${picks.length}, blocked ${blocked}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
