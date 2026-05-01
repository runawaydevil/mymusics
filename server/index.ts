import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import dotenv from "dotenv";
import Fastify from "fastify";

import {
  IA_DRAGON_HOARD_ID,
  loadTracksFromTsv,
  type TrackMeta,
} from "./metadata.js";
import { resolveApiPort } from "../config/ports.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function resolvePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

const PORT = resolveApiPort(process.env);
/** Resolved path to data/metadata.tsv next to the app (independent of METADATA_TSV env). */
const BUNDLED_METADATA_TSV = path.join(__dirname, "..", "data", "metadata.tsv");

/** If METADATA_TSV points to a missing file but the bundled copy exists, use bundled (VPS typo self-heal). */
function resolveEffectiveMetadataTsv(): {
  path: string;
  envRequested: string | null;
  usedFallback: boolean;
} {
  const raw = process.env.METADATA_TSV?.trim();
  if (!raw) {
    return { path: BUNDLED_METADATA_TSV, envRequested: null, usedFallback: false };
  }
  const resolved = resolvePath(raw);
  if (fs.existsSync(resolved)) {
    return { path: resolved, envRequested: resolved, usedFallback: false };
  }
  if (fs.existsSync(BUNDLED_METADATA_TSV)) {
    console.warn(
      `MyMusics: METADATA_TSV not found at ${resolved}; using bundled ${BUNDLED_METADATA_TSV}`,
    );
    return { path: BUNDLED_METADATA_TSV, envRequested: resolved, usedFallback: true };
  }
  return { path: resolved, envRequested: resolved, usedFallback: false };
}

/** Set at runtime in `main()` (and on `/api/reload`) so env matches PM2/dotenv; avoids load-time races. */
let METADATA_TSV = "";
let METADATA_ENV_REQUESTED: string | null = null;
let METADATA_USED_FALLBACK = false;

function applyMetadataPathsFromEnv() {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
  const m = resolveEffectiveMetadataTsv();
  METADATA_TSV = m.path;
  METADATA_ENV_REQUESTED = m.envRequested;
  METADATA_USED_FALLBACK = m.usedFallback;
}

function hintForMetadataNotFound(message: string): string {
  if (!message.includes("not found")) return message;
  if (fs.existsSync(BUNDLED_METADATA_TSV) && METADATA_TSV !== BUNDLED_METADATA_TSV) {
    return `${message} Your METADATA_TSV points elsewhere, but the repo file exists at ${BUNDLED_METADATA_TSV}. Set METADATA_TSV to that path, or remove METADATA_TSV from .env/PM2 to use the default.`;
  }
  if (fs.existsSync(BUNDLED_METADATA_TSV)) {
    return `${message} (unexpected: bundled path exists; check permissions.)`;
  }
  return `${message} Expected a copy at ${BUNDLED_METADATA_TSV} relative to the app install.`;
}
const IA_ITEM_ID = process.env.IA_ITEM_ID?.trim() || IA_DRAGON_HOARD_ID;

const distDir = path.join(__dirname, "..", "dist");
const distIndexPath = path.join(distDir, "index.html");
const distExists = fs.existsSync(distIndexPath);

/** Serve Vite build from dist/ when it exists (typical behind nginx). Opt out with SERVE_STATIC=false. */
const staticDisabled =
  process.env.SERVE_STATIC === "false" || process.env.SERVE_STATIC === "0";
const staticExplicit =
  process.env.SERVE_STATIC === "true" || process.env.SERVE_STATIC === "1";
const serveStatic = !staticDisabled && (staticExplicit || distExists);

let pool: TrackMeta[] = [];
let metadataLoadHint: string | null = null;

function diagnoseEmptyMetadata(tsvPath: string) {
  if (!fs.existsSync(tsvPath)) {
    return `File does not exist. Copy metadata.tsv from the Dragon Hoard dataset and set METADATA_TSV to an absolute path (e.g. /var/www/mymusics-data/metadata.tsv).`;
  }
  const stat = fs.statSync(tsvPath);
  if (stat.size === 0) return "File is empty (0 bytes).";
  const sample = fs.readFileSync(tsvPath, "utf8").slice(0, 8192);
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const cols = firstLine.split("\t").length;
  if (cols < 4) {
    return `First data row has ${cols} tab-separated columns (need at least 4). If you opened the TSV in Excel, it may have been saved as CSV or with semicolons — restore tab-separated format. Preview: ${firstLine.slice(0, 120)}`;
  }
  const lastCol = firstLine.split("\t").pop() ?? "";
  if (!lastCol.includes("myspacecdn") || !lastCol.toLowerCase().includes(".mp3")) {
    return `Last column should be a MySpace CDN URL ending in .mp3. Preview of last column: ${lastCol.slice(0, 80)}`;
  }
  return "Rows parsed but no valid Archive URLs (unexpected — check IA_ITEM_ID and CDN URL shape).";
}

function rebuildPool() {
  metadataLoadHint = null;
  pool = loadTracksFromTsv(METADATA_TSV, IA_ITEM_ID);
  console.info(`MyMusics: loaded ${pool.length} tracks from metadata (Internet Archive)`);
  if (pool.length === 0) {
    metadataLoadHint = diagnoseEmptyMetadata(METADATA_TSV);
    console.warn(`MyMusics: 0 tracks — ${metadataLoadHint}`);
  }
}

function randomTrack(): TrackMeta | null {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Prefer a track whose id differs from `excludeId` when the pool has more than one row. */
function randomTrackExcluding(excludeId: string | undefined): TrackMeta | null {
  if (!pool.length) return null;
  if (!excludeId?.trim() || pool.length === 1) {
    return randomTrack();
  }
  const filtered = pool.filter((t) => t.id !== excludeId);
  if (filtered.length === 0) return randomTrack();
  return filtered[Math.floor(Math.random() * filtered.length)]!;
}

async function main() {
  applyMetadataPathsFromEnv();
  console.info(`MyMusics: cwd=${process.cwd()}`);
  console.info(
    `MyMusics: metadata file ${METADATA_TSV}${METADATA_USED_FALLBACK ? ` (fallback; env had ${METADATA_ENV_REQUESTED})` : ""}`,
  );
  try {
    rebuildPool();
  } catch (e) {
    console.error(e);
    pool = [];
    const raw = e instanceof Error ? e.message : "Failed to load metadata (see server logs).";
    metadataLoadHint = hintForMetadataNotFound(raw);
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  /** Allow embedding the SPA (e.g. /embed iframe on third-party sites). Strip anti-framing headers on HTML. */
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
    return {
      ok: true,
      trackCount: pool.length,
      tracksReady: pool.length > 0,
      metadataTsv: METADATA_TSV,
      ...(METADATA_ENV_REQUESTED && METADATA_ENV_REQUESTED !== METADATA_TSV
        ? { metadataEnvRequested: METADATA_ENV_REQUESTED, metadataUsedFallback: METADATA_USED_FALLBACK }
        : {}),
      metadataExists: fs.existsSync(METADATA_TSV),
      metadataSizeBytes,
      cwd: process.cwd(),
      iaItemId: IA_ITEM_ID,
      ...(metadataLoadHint ? { hint: metadataLoadHint } : {}),
    };
  });

  app.post("/api/reload", async (_req, reply) => {
    try {
      applyMetadataPathsFromEnv();
      const next = loadTracksFromTsv(METADATA_TSV, IA_ITEM_ID);
      pool = next;
      console.info(`MyMusics: reloaded ${pool.length} tracks from metadata`);
      return reply.send({ ok: true, trackCount: pool.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reload metadata";
      return reply.code(500).send({ ok: false, error: message });
    }
  });

  app.get("/api/track/random", async (_req, reply) => {
    const track = randomTrack();
    if (!track) {
      return reply.code(503).send({
        error: "No tracks available. Check that metadata loaded correctly.",
      });
    }
    return reply.send({
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        fileKey: track.fileKey,
      },
      streamUrl: track.archiveUrl,
    });
  });

  app.get("/api/track/up-next", async (req, reply) => {
    const raw = (req.query as { exclude?: string }).exclude;
    const excludeId = typeof raw === "string" ? raw.trim() : undefined;
    const track = randomTrackExcluding(excludeId);
    if (!track) {
      return reply.code(503).send({
        error: "No tracks available. Check that metadata loaded correctly.",
      });
    }
    return reply.send({
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        fileKey: track.fileKey,
      },
      streamUrl: track.archiveUrl,
    });
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
  } else if (distExists) {
    console.info(
      "MyMusics: dist/ exists but SPA is disabled (SERVE_STATIC=false); GET / returns 404, /api only.",
    );
  } else {
    console.info(
      "MyMusics: API only (no dist/). Use `npm run build` or set up Vite dev; nginx should not proxy / to this port until SPA is served.",
    );
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
