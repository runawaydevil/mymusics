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
const METADATA_TSV = process.env.METADATA_TSV
  ? resolvePath(process.env.METADATA_TSV)
  : path.join(__dirname, "..", "..", "data", "metadata.tsv");
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

function rebuildPool() {
  pool = loadTracksFromTsv(METADATA_TSV, IA_ITEM_ID);
  console.info(`MyMusics: loaded ${pool.length} tracks from metadata (Internet Archive)`);
}

function randomTrack(): TrackMeta | null {
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

async function main() {
  try {
    rebuildPool();
  } catch (e) {
    console.error(e);
    pool = [];
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({
    ok: true,
    trackCount: pool.length,
    metadataTsv: METADATA_TSV,
    iaItemId: IA_ITEM_ID,
  }));

  app.post("/api/reload", async (_req, reply) => {
    try {
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
