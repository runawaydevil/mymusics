import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import dotenv from "dotenv";

import { IA_DRAGON_HOARD_ID, parseTrackLine } from "../server/metadata.js";
import { WritableTrackStore } from "../server/trackStore.js";

const PROJECT_ROOT = process.cwd();
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(PROJECT_ROOT, p);
}

const BUNDLED_METADATA_TSV = path.join(PROJECT_ROOT, "data", "metadata.tsv");
const BUNDLED_TRACKS_DB = path.join(PROJECT_ROOT, "data", "tracks.db");

function resolveMetadataTsv(): string {
  const raw = process.env.METADATA_TSV?.trim();
  if (!raw) return BUNDLED_METADATA_TSV;
  const resolved = resolvePath(raw);
  if (fs.existsSync(resolved)) return resolved;
  if (fs.existsSync(BUNDLED_METADATA_TSV)) return BUNDLED_METADATA_TSV;
  return resolved;
}

function resolveTracksDb(): string {
  const raw = process.env.TRACKS_DB?.trim();
  return raw ? resolvePath(raw) : BUNDLED_TRACKS_DB;
}

function isStale(tsvPath: string, dbPath: string): boolean {
  if (!fs.existsSync(dbPath)) return true;
  if (!fs.existsSync(tsvPath)) return false;
  const tsvMtime = fs.statSync(tsvPath).mtimeMs;
  const dbMtime = fs.statSync(dbPath).mtimeMs;
  return tsvMtime > dbMtime;
}

async function indexFromTsv(tsvPath: string, dbPath: string, itemId: string): Promise<number> {
  const store = new WritableTrackStore(dbPath);
  store.open();
  store.clearTracks();

  const BATCH = 5000;
  let batch: ReturnType<typeof parseTrackLine>[] = [];
  let total = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(tsvPath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const track = parseTrackLine(line, itemId);
    if (!track) continue;
    batch.push(track);
    if (batch.length >= BATCH) {
      store.insertBatch(batch.filter(Boolean) as NonNullable<typeof track>[]);
      total += batch.length;
      batch = [];
      if (total % 50_000 === 0) console.info(`MyMusics index: ${total} tracks…`);
    }
  }
  if (batch.length > 0) {
    store.insertBatch(batch as NonNullable<(typeof batch)[0]>[]);
    total += batch.length;
  }

  console.info("MyMusics index: rebuilding FTS…");
  store.finishIndex();
  store.close();
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const ifStale = args.includes("--if-stale");
  const force = args.includes("--force");

  const tsvPath = resolveMetadataTsv();
  const dbPath = resolveTracksDb();
  const itemId = process.env.IA_ITEM_ID?.trim() || IA_DRAGON_HOARD_ID;

  if (!fs.existsSync(tsvPath)) {
    console.error(`METADATA_TSV not found: ${tsvPath}`);
    process.exit(1);
  }

  if (ifStale && !force && !isStale(tsvPath, dbPath)) {
    console.info(`MyMusics index: ${dbPath} is up to date (use --force to rebuild).`);
    return;
  }

  const t0 = Date.now();
  console.info(`MyMusics index: ${tsvPath} → ${dbPath}`);
  const count = await indexFromTsv(tsvPath, dbPath, itemId);
  console.info(`MyMusics index: ${count} tracks in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
