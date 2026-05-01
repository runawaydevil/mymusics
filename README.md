# MyMusics

Retro-styled web player that picks random tracks from [`data/metadata.tsv`](data/metadata.tsv) and streams MP3s from the Internet Archive item [**The Myspace Dragon Hoard (2008–2010)**](https://archive.org/details/myspace_dragon_hoard_2010). URLs follow the same pattern as the official IA “Hobbit” player (ZIP member paths).

## Requirements

- Node.js 20+
- `data/metadata.tsv` in this repo (Dragon Hoard export). No local MP3 mirror is required.

## Configuration

1. Copy `.env.example` to `.env` and adjust:

   - `METADATA_TSV` — path to `metadata.tsv` (default: `data/metadata.tsv` inside this project).
   - **Ports** — defined in [`config/ports.ts`](config/ports.ts) as paired pools. Use `PORT_INDEX` (0–3) to pick a pair, or set `PORT` / `VITE_DEV_PORT` explicitly. Defaults: API `38471`, Vite dev `38472` (index 0).
   - `IA_ITEM_ID` (optional) — Internet Archive item id (default `myspace_dragon_hoard_2010`).
   - `SERVE_STATIC` — if `dist/index.html` exists after `npm run build`, the app serves the SPA + `/api` automatically. Set `SERVE_STATIC=false` for API-only. Explicit `true`/`1` is optional; use it when you want a clear flag in PM2/systemd.

2. Install dependencies:

   ```bash
   npm install
   ```

## Development

Start the API and the Vite app together (`/api` → `http://localhost:38471` with default `PORT_INDEX=0`):

```bash
npm run dev
```

Open the URL Vite prints (by default `http://localhost:38472` with `PORT_INDEX=0`).

## Production (static build + API)

One process can serve both the SPA and `/api` after build:

```bash
npm run build
SERVE_STATIC=true npm run start
```

Or use **PM2** (from this folder, after `npm run build`):

```bash
npm run pm2:prod
# or: pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Set `METADATA_TSV` to an **absolute path** on the server inside `ecosystem.config.cjs` → `env_production`, or use a `.env` next to the app.

### VPS: “No tracks available” / `trackCount: 0`

1. Ensure **`data/metadata.tsv`** is present after `git clone` / deploy (large file; clone may take a while). If you omitted it, copy `metadata.tsv` next to the app and set **`METADATA_TSV`** to an **absolute path**. Relative paths resolve from **`process.cwd()`** (the app root).
2. Restart the process and check **`GET /api/health`**: you should see `tracksReady: true`, `trackCount` > 0, `metadataExists: true`, and a `hint` if something is still wrong.

### Reverse proxy (e.g. `mymusics.murad.gg`)

Point HTTPS at the Node port (default from pool index 0: `38471`, or whatever `PORT` / `PORT_INDEX` sets). Example **nginx**:

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

No extra `vite.config` base URL is needed when the site is served at the domain root.

## Playback notes

- The browser loads audio directly from `https://archive.org/download/...` URLs. First play may be slow while the Archive serves the file from inside large ZIPs.
- This is **not** DRM; users can still capture network traffic or use devtools.

## Scripts

| Command           | Description                                      |
|-------------------|--------------------------------------------------|
| `npm run dev`     | Vite + API with hot reload                       |
| `npm run build`   | Production frontend build                        |
| `npm run start`   | API (`tsx server/index.ts`); use `SERVE_STATIC=true` to also serve `dist/` |
| `npm run pm2:prod`| `npm run build` then PM2 with `ecosystem.config.cjs` |

## Logo

`public/mymusics.png` is the MyMusics logo asset.
