# MyMusics

Retro-styled web player that picks random tracks from [`data/metadata.tsv`](data/metadata.tsv) and streams MP3s from the Internet Archive item [**The Myspace Dragon Hoard (2008–2010)**](https://archive.org/details/myspace_dragon_hoard_2010). URLs follow the same pattern as the official IA “Hobbit” player (ZIP member paths).

The API uses a **SQLite index** (`data/tracks.db`) built from the TSV for fast random selection, search, and lookup by id — without loading hundreds of thousands of rows into RAM.

## Requirements

- Node.js 20+
- `data/metadata.tsv` (Dragon Hoard export). No local MP3 mirror is required.
- After clone/deploy: run **`npm run index-metadata`** once (or on each TSV update) to create `data/tracks.db`.

## Configuration

1. Copy `.env.example` to `.env` and adjust:

   - `METADATA_TSV` — path to `metadata.tsv` (default: `data/metadata.tsv`).
   - `TRACKS_DB` — SQLite index (default: `data/tracks.db`).
   - **Ports** — [`config/ports.ts`](config/ports.ts): `PORT_INDEX` (0–3) or explicit `PORT` / `VITE_DEV_PORT`. Defaults: API `38471`, Vite `38472`.
   - `IA_ITEM_ID` (optional) — Internet Archive item id (default `myspace_dragon_hoard_2010`).
   - `SERVE_STATIC` — serve SPA from `dist/` on the API port when built.
   - `CORS_ORIGINS` — comma-separated API CORS origins (production defaults to the public site).
   - `PUBLIC_SITE_URL` / `VITE_PUBLIC_SITE_URL` — canonical URL for share links, oEmbed, embed snippet.
   - `VITE_EMBED_PARENT_ORIGIN` — restrict embed `postMessage` target (optional).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the track index (required before first API start):

   ```bash
   npm run index-metadata
   ```

   Use `npm run index-metadata -- --if-stale` to skip when the DB is newer than the TSV (used by `npm run build`). Use `--force` to rebuild always.

## Development

Fast dev with a small TSV sample (optional):

```bash
npm run sample-metadata
# set METADATA_TSV=data/metadata.sample.tsv in .env, then:
npm run index-metadata -- --force
```

Start API + Vite:

```bash
npm run dev
```

Open the URL Vite prints (default `http://localhost:38472`).

## Production (static build + API)

```bash
npm run build
SERVE_STATIC=true npm run start
```

`npm run build` runs `index-metadata --if-stale`, compiles the server, and builds the SPA.

**PM2** (after `npm run build`):

```bash
npm run pm2:prod
pm2 save
```

Set `METADATA_TSV` / `TRACKS_DB` in `ecosystem.config.cjs` → `env_production` on the VPS. Re-run **`npm run index-metadata`** when `metadata.tsv` changes.

### Docker

```bash
docker compose build
docker compose up
```

Ensure `data/metadata.tsv` is present under `./data` (volume). The image runs `index-metadata --if-stale` during build when the TSV is copied in.

### VPS: “No tracks available” / `trackCount: 0`

1. Ensure **`data/metadata.tsv`** exists and run **`npm run index-metadata`**.
2. Check **`GET /api/health`**: `tracksReady: true`, `tracksDbExists: true`, `trackCount` > 0, `ftsReady: true`, and `hint` if something failed.
3. Restart PM2 after env changes: `pm2 restart mymusics --update-env`.

### Reverse proxy (e.g. `mymusics.murad.gg`)

Point HTTPS at the Node port (default `38471`). Example **nginx**:

```nginx
server {
  server_name mymusics.murad.gg;
  location / {
    proxy_pass http://127.0.0.1:38471;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Embed on third-party sites:** HTML responses use `Content-Security-Policy: frame-ancestors *`. Ensure the proxy does not add `X-Frame-Options: DENY`.

## Embed (`/embed`) — priority

Iframe URL: `https://mymusics.murad.gg/embed` with optional query params:

| Param | Default | Effect |
|-------|---------|--------|
| `autoplay` | `1` | `0` disables auto-advance and skips random load on mount |
| `theme` | `default` | `compact` — smaller layout |
| `start` | — | Track id — loads `GET /api/track/:id` |
| `brand` | `1` | `0` hides footer logo |
| `muted` | `0` | `1` starts muted |

**postMessage** (iframe → parent), payload `{ source: "mymusics", type, ... }`:

- `mymusics:ready` — `{ trackCount }`
- `mymusics:track` — `{ id, title, artist, streamUrl }`
- `mymusics:state` — `{ state: "playing" \| "paused" \| "buffering" \| "error" }`
- `mymusics:error` — `{ code, message }`

Parent → iframe: `{ source: "mymusics-host", type: "mymusics:command", command: "play" \| "pause" \| "next" }`.

**oEmbed:** `GET /api/oembed?url=https://mymusics.murad.gg/embed`

The Home and About pages include a snippet generator with these options.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Diagnostics (`tracksDb`, `ftsReady`, `blockedCount`, …) |
| GET | `/api/track/random` | Random track + `streamUrl` |
| GET | `/api/track/up-next?exclude=` | Next track (prefers different id) |
| GET | `/api/track/:id` | Track by id |
| GET | `/api/track/search?q=&limit=` | Search by title/artist (FTS) |
| POST | `/api/reload` | Reload DB / paths from env |
| POST | `/api/events` | Client metrics (`stream_error`, `time_to_play`) |
| GET | `/api/oembed?url=` | oEmbed JSON for `/embed` |

## Share links

- `https://mymusics.murad.gg/?track=TRACK_ID`
- `https://mymusics.murad.gg/t/TRACK_ID` (redirects to `/?track=`)

## Maintenance

Weekly cron (optional) — sample Archive URLs and block failures:

```bash
npm run verify-tracks
```

Env: `VERIFY_SAMPLE_SIZE` (default `50`).

## Troubleshooting

### HTTP 503 on `/api/track/random`

The pool is empty. Run `npm run index-metadata` and verify `/api/health`.

### Console: TensorFlow / `content.js` messages

These come from **browser extensions**, not MyMusics.

## Playback notes

- Audio streams from `https://archive.org/download/...`. First play can be slow (ZIP member extraction).
- Archive **503** errors are retried automatically a few times; use **Next** if needed.
- Volume is remembered in `localStorage`. Shortcuts on Home: Space, N, M.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite + API |
| `npm run index-metadata` | Build `data/tracks.db` from TSV |
| `npm run index-metadata:force` | Force rebuild index |
| `npm run sample-metadata` | Write `data/metadata.sample.tsv` (500 lines) |
| `npm run verify-tracks` | HEAD sample URLs → `blocked_ids` |
| `npm run build` | Index (if stale) + server + SPA |
| `npm run start` | Production Node server |
| `npm run test` | Vitest (metadata + track store) |
| `npm run pm2:prod` | Build + PM2 |

## Logo

`public/mymusics.png` is the MyMusics logo asset.
