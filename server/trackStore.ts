import fs from "node:fs";

import Database from "better-sqlite3";

import type { TrackMeta } from "./metadata.js";

export const TRACKS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  file_key TEXT NOT NULL,
  cdn_url TEXT NOT NULL,
  archive_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocked_ids (
  id TEXT PRIMARY KEY
);
`;

export function initTracksDb(db: Database.Database): void {
  db.exec(TRACKS_SCHEMA_SQL);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
      title,
      artist,
      tokenize='unicode61'
    );
  `);
}

export function rebuildFts(db: Database.Database): void {
  db.exec(`DELETE FROM tracks_fts;`);
  db.exec(`
    INSERT INTO tracks_fts(rowid, title, artist)
    SELECT rowid, title, artist FROM tracks;
  `);
}

export class TrackStore {
  protected db: Database.Database | null = null;

  constructor(private readonly dbPath: string) {}

  open(): void {
    if (this.db) return;
    if (this.dbPath !== ":memory:") {
      const dir = this.dbPath.replace(/[/\\][^/\\]+$/, "");
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(this.dbPath, { readonly: false });
    this.db.pragma("journal_mode = WAL");
    initTracksDb(this.db);
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  reload(): void {
    this.close();
    this.open();
  }

  exists(): boolean {
    return fs.existsSync(this.dbPath);
  }

  get path(): string {
    return this.dbPath;
  }

  protected requireDb(): Database.Database {
    if (!this.db) throw new Error("TrackStore not open");
    return this.db;
  }

  count(): number {
    const row = this.requireDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM tracks t
         WHERE NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)`,
      )
      .get() as { c: number };
    return row.c;
  }

  blockedCount(): number {
    const row = this.requireDb().prepare(`SELECT COUNT(*) AS c FROM blocked_ids`).get() as {
      c: number;
    };
    return row.c;
  }

  ftsReady(): boolean {
    try {
      const row = this.requireDb()
        .prepare(`SELECT COUNT(*) AS c FROM tracks_fts`)
        .get() as { c: number };
      return row.c > 0;
    } catch {
      return false;
    }
  }

  getById(id: string): TrackMeta | null {
    const row = this.requireDb()
      .prepare(
        `SELECT id, title, artist, file_key, cdn_url, archive_url FROM tracks t
         WHERE t.id = ? AND NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)`,
      )
      .get(id.trim()) as Row | undefined;
    return row ? rowToMeta(row) : null;
  }

  random(excludeId?: string): TrackMeta | null {
    const db = this.requireDb();
    const ex = excludeId?.trim();
    if (ex) {
      const row = db
        .prepare(
          `SELECT id, title, artist, file_key, cdn_url, archive_url FROM tracks t
           WHERE t.id != ?
           AND NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)
           ORDER BY RANDOM() LIMIT 1`,
        )
        .get(ex) as Row | undefined;
      if (row) return rowToMeta(row);
    }
    const row = db
      .prepare(
        `SELECT id, title, artist, file_key, cdn_url, archive_url FROM tracks t
         WHERE NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)
         ORDER BY RANDOM() LIMIT 1`,
      )
      .get() as Row | undefined;
    return row ? rowToMeta(row) : null;
  }

  search(q: string, limit = 20): Pick<TrackMeta, "id" | "title" | "artist">[] {
    const trimmed = q.trim();
    if (trimmed.length < 2) return [];
    const cap = Math.min(Math.max(1, limit), 50);
    const db = this.requireDb();

    try {
      const ftsQuery = trimmed
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `"${w.replace(/"/g, '""')}"*`)
        .join(" ");
      const rows = db
        .prepare(
          `SELECT t.id, t.title, t.artist FROM tracks_fts f
           JOIN tracks t ON t.rowid = f.rowid
           WHERE tracks_fts MATCH ?
           AND NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)
           LIMIT ?`,
        )
        .all(ftsQuery, cap) as SearchRow[];
      if (rows.length > 0) return rows;
    } catch {
      /* fallback below */
    }

    const escaped = trimmed.replace(/[%_\\]/g, (c) => `\\${c}`);
    const like = `%${escaped}%`;
    return db
      .prepare(
        `SELECT id, title, artist FROM tracks t
         WHERE (title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\')
         AND NOT EXISTS (SELECT 1 FROM blocked_ids b WHERE b.id = t.id)
         LIMIT ?`,
      )
      .all(like, like, cap) as SearchRow[];
  }

  blockId(id: string): void {
    this.requireDb()
      .prepare(`INSERT OR IGNORE INTO blocked_ids (id) VALUES (?)`)
      .run(id.trim());
  }

  sampleArchiveUrls(limit: number): { id: string; archiveUrl: string }[] {
    return this.requireDb()
      .prepare(
        `SELECT id, archive_url AS archiveUrl FROM tracks
         ORDER BY RANDOM() LIMIT ?`,
      )
      .all(limit) as { id: string; archiveUrl: string }[];
  }
}

type Row = {
  id: string;
  title: string;
  artist: string;
  file_key: string;
  cdn_url: string;
  archive_url: string;
};

type SearchRow = { id: string; title: string; artist: string };

function rowToMeta(row: Row): TrackMeta {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    fileKey: row.file_key,
    cdnUrl: row.cdn_url,
    archiveUrl: row.archive_url,
  };
}

/** Writable store for indexing (batch insert + FTS rebuild). */
export class WritableTrackStore extends TrackStore {
  insertBatch(tracks: TrackMeta[]): void {
    const db = this.requireDb();
    const insert = db.prepare(
      `INSERT OR REPLACE INTO tracks (id, title, artist, file_key, cdn_url, archive_url)
       VALUES (@id, @title, @artist, @fileKey, @cdnUrl, @archiveUrl)`,
    );
    const tx = db.transaction((rows: TrackMeta[]) => {
      for (const t of rows) {
        insert.run({
          id: t.id,
          title: t.title,
          artist: t.artist,
          fileKey: t.fileKey,
          cdnUrl: t.cdnUrl,
          archiveUrl: t.archiveUrl,
        });
      }
    });
    tx(tracks);
  }

  clearTracks(): void {
    const db = this.requireDb();
    db.exec(`DELETE FROM tracks;`);
    try {
      db.exec(`DELETE FROM tracks_fts;`);
    } catch {
      /* fts may not exist yet */
    }
  }

  finishIndex(): void {
    rebuildFts(this.requireDb());
  }
}
