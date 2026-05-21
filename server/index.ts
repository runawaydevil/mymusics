import fs from "node:fs";
import path from "node:path";

import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import dotenv from "dotenv";
import Fastify from "fastify";

import { buildOEmbedResponse } from "./oembed.js";
import {
  IA_DRAGON_HOARD_ID,
  loadTracksFromTsv,
  type TrackMeta,
} from "./metadata.js";
import {
  bundledMetadataTsv,
  getProjectRoot,
  resolveEffectiveMetadataTsv,
  resolveTracksDb,
} from "./paths.js";
import { rateLimit } from "./rateLimit.js";
import { TrackStore } from "./trackStore.js";
import { resolveApiPort } from "../config/ports.js";

const PROJECT_ROOT = getProjectRoot();

dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

const PORT = resolveApiPort(process.env);
const IA_ITEM_ID = process.env.IA_ITEM_ID?.trim() || IA_DRAGON_HOARD_ID;
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL?.trim() || "https://mymusics.murad.gg";

let METADATA_TSV = "";
let METADATA_ENV_REQUESTED: string | null = null;
let METADATA_USED_FALLBACK = false;
let TRACKS_DB_PATH = "";

let store: TrackStore | null = null;
let tsvFallbackPool: TrackMeta[] = [];
let useTsvFallback = false;
let metadataLoadHint: string | null = null;

function applyPathsFromEnv() {
  dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });
  const m = resolveEffectiveMetadataTsv(process.env, PROJECT_ROOT);
  METADATA_TSV = m.path;
  METADATA_ENV_REQUESTED = m.envRequested;
  METADATA_USED_FALLBACK = m.usedFallback;
  TRACKS_DB_PATH = resolveTracksDb(process.env, PROJECT_ROOT);
}

function hintForMetadataNotFound(message: string): string {
  if (!message.includes("not found")) return message;
  const bundled = bundledMetadataTsv(PROJECT_ROOT);
  if (fs.existsSync(bundled) && METADATA_TSV !== bundled) {
    return `${message} Your METADATA_TSV points elsewhere, but the repo file exists at ${bundled}. Set METADATA_TSV to that path, or remove METADATA_TSV from .env/PM2 to use the default.`;
  }
  return `${message} Run npm run index-metadata after placing metadata.tsv.`;
}

function diagnoseEmptyMetadata(tsvPath: string) {
  if (!fs.existsSync(tsvPath)) {
    return `File does not exist. Copy metadata.tsv from the Dragon Hoard dataset and run npm run index-metadata.`;
  }
  const stat = fs.statSync(tsvPath);
  if (stat.size === 0) return "File is empty (0 bytes).";
  return "Rows parsed but no valid tracks in database. Run npm run index-metadata.";
}

function trackCount(): number {
  if (store && !useTsvFallback) return store.count();
  return tsvFallbackPool.length;
}

function pickRandom(excludeId?: string): TrackMeta | null {
  if (store && !useTsvFallback) return store.random(excludeId);
  if (!tsvFallbackPool.length) return null;
  const ex = excludeId?.trim();
  if (ex && tsvFallbackPool.length > 1) {
    const filtered = tsvFallbackPool.filter((t) => t.id !== ex);
    if (filtered.length > 0) {
      return filtered[Math.floor(Math.random() * filtered.length)]!;
    }
  }
  return tsvFallbackPool[Math.floor(Math.random() * tsvFallbackPool.length)]!;
}

function getById(id: string): TrackMeta | null {
  if (store && !useTsvFallback) return store.getById(id);
  return tsvFallbackPool.find((t) => t.id === id.trim()) ?? null;
}

function searchTracks(q: string, limit: number) {
  if (store && !useTsvFallback) return store.search(q, limit);
  const trimmed = q.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  return tsvFallbackPool
    .filter(
      (t) =>
        t.title.toLowerCase().includes(trimmed) ||
        t.artist.toLowerCase().includes(trimmed),
    )
    .slice(0, limit)
    .map((t) => ({ id: t.id, title: t.title, artist: t.artist }));
}

function toTrackPayload(track: TrackMeta) {
  return {
    track: {
      id: track.id,
      title: track.title,
      artist: track.artist,
      fileKey: track.fileKey,
    },
    streamUrl: track.archiveUrl,
  };
}

function rebuildStore() {
  metadataLoadHint = null;
  applyPathsFromEnv();

  if (fs.existsSync(TRACKS_DB_PATH)) {
    store?.close();
    store = new TrackStore(TRACKS_DB_PATH);
    store.open();
    useTsvFallback = false;
    const count = store.count();
    console.info(`MyMusics: ${count} tracks from SQLite ${TRACKS_DB_PATH}`);
    if (count === 0) {
      metadataLoadHint = diagnoseEmptyMetadata(METADATA_TSV);
      console.warn(`MyMusics: 0 tracks — ${metadataLoadHint}`);
    }
    return;
  }

  console.warn(
    `MyMusics: ${TRACKS_DB_PATH} missing — falling back to TSV (slow). Run: npm run index-metadata`,
  );
  store?.close();
  store = null;
  useTsvFallback = true;
  tsvFallbackPool = loadTracksFromTsv(METADATA_TSV, IA_ITEM_ID);
  console.info(`MyMusics: loaded ${tsvFallbackPool.length} tracks from TSV fallback`);
  if (tsvFallbackPool.length === 0) {
    metadataLoadHint = diagnoseEmptyMetadata(METADATA_TSV);
  }
}

function resolveCorsOrigin(): boolean | string | RegExp | (string | RegExp)[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      return [PUBLIC_SITE_URL, "https://mymusics.murad.gg"];
    }
    return true;
  }
  if (raw === "*") return true;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

const distDir = path.join(PROJECT_ROOT, "dist");
const distIndexPath = path.join(distDir, "index.html");
const distExists = fs.existsSync(distIndexPath);

const staticDisabled =
  process.env.SERVE_STATIC === "false" || process.env.SERVE_STATIC === "0";
const staticExplicit =
  process.env.SERVE_STATIC === "true" || process.env.SERVE_STATIC === "1";
const serveStatic = !staticDisabled && (staticExplicit || distExists);

async function main() {
  applyPathsFromEnv();
  console.info(`MyMusics: cwd=${process.cwd()}`);
  console.info(`MyMusics: metadata ${METADATA_TSV}`);
  console.info(`MyMusics: tracks db ${TRACKS_DB_PATH}`);

  try {
    rebuildStore();
  } catch (e) {
    console.error(e);
    store = null;
    useTsvFallback = true;
    tsvFallbackPool = [];
    const raw = e instanceof Error ? e.message : "Failed to load tracks.";
    metadataLoadHint = hintForMetadataNotFound(raw);
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: resolveCorsOrigin() });

  app.addHook("onSend", async (_request, reply, payload) => {
    const ct = reply.getHeader("content-type");
    const ctStr = Array.isArray(ct) ? ct[0] : ct;
    if (typeof ctStr === "string" && ctStr.includes("text/html")) {
      reply.header("Content-Security-Policy", "frame-ancestors *");
      reply.removeHeader("x-frame-options");
      reply.removeHeader("X-Frame-Options");
    }
    return payload;
  });

  app.get("/api/health", async () => {
    let metadataSizeBytes: number | null = null;
    try {
      if (fs.existsSync(METADATA_TSV)) metadataSizeBytes = fs.statSync(METADATA_TSV).size;
    } catch {
      metadataSizeBytes = null;
    }
    const count = trackCount();
    return {
      ok: true,
      trackCount: count,
      tracksReady: count > 0,
      tracksDb: TRACKS_DB_PATH,
      tracksDbExists: fs.existsSync(TRACKS_DB_PATH),
      useTsvFallback,
      ftsReady: store ? store.ftsReady() : false,
      blockedCount: store && !useTsvFallback ? store.blockedCount() : 0,
      metadataTsv: METADATA_TSV,
      ...(METADATA_ENV_REQUESTED && METADATA_ENV_REQUESTED !== METADATA_TSV
        ? { metadataEnvRequested: METADATA_ENV_REQUESTED, metadataUsedFallback: METADATA_USED_FALLBACK }
        : {}),
      metadataExists: fs.existsSync(METADATA_TSV),
      metadataSizeBytes,
      cwd: process.cwd(),
      iaItemId: IA_ITEM_ID,
      hint:
        metadataLoadHint ??
        (!fs.existsSync(TRACKS_DB_PATH) && !useTsvFallback
          ? "Run npm run index-metadata to build data/tracks.db"
          : undefined),
    };
  });

  app.post("/api/reload", async (_req, reply) => {
    try {
      rebuildStore();
      return reply.send({ ok: true, trackCount: trackCount() });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reload";
      return reply.code(500).send({ ok: false, error: message });
    }
  });

  app.get("/api/track/search", async (req, reply) => {
    const q = (req.query as { q?: string }).q ?? "";
    const limitRaw = (req.query as { limit?: string }).limit;
    const limit = limitRaw ? Math.min(50, Math.max(1, Number(limitRaw) || 20)) : 20;
    return reply.send({ tracks: searchTracks(q, limit) });
  });

  app.get("/api/track/random", async (_req, reply) => {
    const track = pickRandom();
    if (!track) {
      return reply.code(503).send({
        error: "No tracks available. Check that metadata loaded correctly.",
      });
    }
    return reply.send(toTrackPayload(track));
  });

  app.get("/api/track/up-next", async (req, reply) => {
    const raw = (req.query as { exclude?: string }).exclude;
    const excludeId = typeof raw === "string" ? raw.trim() : undefined;
    const track = pickRandom(excludeId);
    if (!track) {
      return reply.code(503).send({
        error: "No tracks available. Check that metadata loaded correctly.",
      });
    }
    return reply.send(toTrackPayload(track));
  });

  app.get("/api/track/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id?.trim();
    if (!id) return reply.code(400).send({ error: "Missing track id" });
    const track = getById(id);
    if (!track) return reply.code(404).send({ error: "Track not found" });
    return reply.send(toTrackPayload(track));
  });

  app.post("/api/events", async (req, reply) => {
    const ip = req.ip;
    const rl = rateLimit(`events:${ip}`, 60, 60_000);
    if (!rl.ok) {
      return reply.code(429).send({ error: "Too many events", retryAfterSec: rl.retryAfterSec });
    }
    const body = req.body as {
      type?: string;
      trackId?: string;
      detail?: string;
      ms?: number;
    };
    const type = body?.type?.trim();
    if (type !== "stream_error" && type !== "time_to_play") {
      return reply.code(400).send({ error: "Invalid event type" });
    }
    req.log.info({ event: type, trackId: body.trackId, detail: body.detail, ms: body.ms });
    return reply.send({ ok: true });
  });

  app.get("/api/oembed", async (req, reply) => {
    const url = (req.query as { url?: string }).url ?? "";
    const data = buildOEmbedResponse(url, PUBLIC_SITE_URL);
    if (!data) return reply.code(404).send({ error: "URL not supported for oEmbed" });
    return reply.send(data);
  });

  app.get("/.well-known/oembed", async (req, reply) => {
    const url = (req.query as { url?: string }).url ?? "";
    const data = buildOEmbedResponse(url, PUBLIC_SITE_URL);
    if (!data) return reply.code(404).send({ error: "URL not supported for oEmbed" });
    return reply.send(data);
  });

  if (serveStatic) {
    if (distExists) {
      await app.register(fastifyStatic, {
        root: distDir,
        prefix: "/",
      });
      app.setNotFoundHandler((request, reply) => {
        const pathname = request.url.split("?")[0] ?? "";
        if (pathname.startsWith("/api")) {
          return reply.code(404).send({ error: "Not found" });
        }
        return reply.sendFile("index.html");
      });
      console.info(`MyMusics: serving SPA + /api from ${distDir}`);
    } else {
      console.warn(
        "MyMusics: SERVE_STATIC requested but dist/index.html is missing — run `npm run build` on the server.",
      );
    }
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
